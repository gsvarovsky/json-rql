var _ = require('lodash'),
    _jrql = require('../index'),
    _async = require('async'),
    pass = require('pass-error'),
    sparqlParser = new (require('sparqljs').Parser)(),
    tempSubject = 'http://json-rql.org/subject',
    tempPredicate = 'http://json-rql.org/predicate';

module.exports = function (sparql, cb/*(err, jsonRql, parsed)*/) {
  var parsed = sparqlParser.parse(sparql);

  function expressionToJsonLd(expr, cb/*(err, jsonld)*/) {
    if (!_.isObject(expr)) {
      var tempTriple = { subject : tempSubject, predicate : tempPredicate, object : _jrql.hideVar(expr) };
      return _jrql.toJsonLd([tempTriple], parsed.prefixes, pass(function (jsonld) {
        return cb(false, _jrql.unhideVars(jsonld[tempPredicate]));
      }, cb));
    } else if (expr.type === 'operation') {
      var op = _jrql.operators[expr.operator];
      return op ? _jrql.miniMap(expr.args, expressionToJsonLd, pass(function (jsonlds) {
        return cb(false, _.set({}, op, jsonlds));
      }, cb)) : cb('Unsupported operator: ' + expr.operator);
    } else {
      return cb('Unsupported expression: ' + expr.type);
    }
  }

  function triplesToJsonLd(triples, cb) {
    return _jrql.toJsonLd(_.map(triples, function (triple) {
      return _.mapValues(triple, _jrql.hideVar);
    }), parsed.prefixes, pass(function (jsonld) {
      jsonld = _.omit(jsonld, '@context');
      // Optimise away redundant top-level objects
      jsonld = jsonld['@graph'] ? _jrql.nestGraph(jsonld['@graph']) : jsonld;
      // Unhide hidden subjects and predicates
      cb(false, _jrql.unhideVars(jsonld));
    }, cb));
  }

  function clausesToJsonLd(clauses, cb) {
    var byType = _.mapValues(_.groupBy(clauses, 'type'), function (homoClauses) {
      return !_.isEmpty(homoClauses) && function (key) {
        return _.flatten(_.map(homoClauses, key));
      }
    });
    return _jrql.ast({
      '@graph' : byType.bgp ? [triplesToJsonLd, byType.bgp('triples')] : undefined,
      '@filter' : byType.filter ? [_jrql.miniMap, byType.filter('expression'), expressionToJsonLd] : undefined,
      '@optional' : byType.optional ? [clausesToJsonLd, byType.optional('patterns')] : undefined,
      '@union' : byType.union ? // Each 'group' is an array of patterns
        [_async.map, _.map(byType.union('patterns'), 'patterns'), clausesToJsonLd] : undefined
    }, pass(function (result) {
      // If a graph is the only thing we have, flatten it
      result = _.pickBy(result);
      return cb(false, _.isEqual(_.keys(result), ['@graph']) ? result['@graph'] : result);
    }, cb));
  }

  _jrql.ast({
    '@context' : !_.isEmpty(parsed.prefixes) ? parsed.prefixes : undefined,
    '@construct' : parsed.queryType === 'CONSTRUCT' ? [triplesToJsonLd, parsed.template] : undefined,
    '@select' : parsed.queryType === 'SELECT' && !parsed.distinct ? parsed.variables : undefined,
    '@distinct' : parsed.queryType === 'SELECT' && parsed.distinct ? parsed.variables : undefined,
    '@where' : parsed.where ? [clausesToJsonLd, parsed.where] : undefined,
    '@orderBy' : [_jrql.miniMap, _.map(parsed.order, 'expression'), expressionToJsonLd],
    '@limit' : parsed.limit,
    '@offset' : parsed.offset
  }, pass(function (jsonRql) {
    return cb(false, jsonRql, parsed);
  }, cb));
};
