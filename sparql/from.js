var _ = require('lodash'),
    _util = require('../util'),
    _async = require('async'),
    pass = require('pass-error'),
    sparqlParser = new (require('sparqljs').Parser)(),
    tempSubject = 'http://json-rql.org/subject',
    tempPredicate = 'http://json-rql.org/predicate';

module.exports = function (sparql, cb/*(err, jsonRql, parsed)*/) {
  var parsed = sparqlParser.parse(sparql);

  function expressionToJsonLd(expr, cb/*(err, jsonld)*/) {
    if (!_.isObject(expr)) {
      var tempTriple = { subject : tempSubject, predicate : tempPredicate, object : _util.hideVar(expr) };
      return _util.toJsonLd([tempTriple], parsed.prefixes, pass(function (jsonld) {
        return cb(false, _util.unhideVars(jsonld[tempPredicate]));
      }, cb));
    } else if (expr.type === 'operation') {
      var op = _util.operators[expr.operator];
      return op ? _util.miniMap(expr.args, expressionToJsonLd, pass(function (jsonlds) {
        return cb(false, _.set({}, op, jsonlds));
      }, cb)) : cb('Unsupported operator: ' + expr.operator);
    } else {
      return cb('Unsupported expression: ' + expr.type);
    }
  }

  function triplesToJsonLd(triples, cb) {
    return _util.toJsonLd(_.map(triples, function (triple) {
      return _.mapValues(triple, _util.hideVar);
    }), parsed.prefixes, pass(function (jsonld) {
      jsonld = _.omit(jsonld, '@context');
      // Optimise away redundant top-level objects
      jsonld = jsonld['@graph'] ? _util.nestGraph(jsonld['@graph']) : jsonld;
      // Unhide hidden subjects and predicates
      cb(false, _util.unhideVars(jsonld));
    }, cb));
  }

  function clausesToJsonLd(clauses, cb) {
    var byType = _.mapValues(_.groupBy(clauses, 'type'), function (homoClauses) {
      return !_.isEmpty(homoClauses) && function (key) {
        return _.flatten(_.map(homoClauses, key));
      }
    });
    return _util.ast({
      '@graph' : byType.bgp ? [triplesToJsonLd, byType.bgp('triples')] : undefined,
      '@filter' : byType.filter ? [_util.miniMap, byType.filter('expression'), expressionToJsonLd] : undefined,
      '@optional' : byType.optional ? [clausesToJsonLd, byType.optional('patterns')] : undefined,
      '@union' : byType.union ? // Each 'group' is an array of patterns
        [_async.map, _.map(byType.union('patterns'), 'patterns'), clausesToJsonLd] : undefined
    }, pass(function (result) {
      // If a graph is the only thing we have, flatten it
      result = _.pickBy(result);
      return cb(false, _.isEqual(_.keys(result), ['@graph']) ? result['@graph'] : result);
    }, cb));
  }

  _util.ast({
    '@context' : !_.isEmpty(parsed.prefixes) ? parsed.prefixes : undefined,
    '@construct' : parsed.queryType === 'CONSTRUCT' ? [triplesToJsonLd, parsed.template] : undefined,
    '@select' : parsed.queryType === 'SELECT' && !parsed.distinct ? parsed.variables : undefined,
    '@distinct' : parsed.queryType === 'SELECT' && parsed.distinct ? parsed.variables : undefined,
    '@where' : parsed.where ? [clausesToJsonLd, parsed.where] : undefined,
    '@orderBy' : [_util.miniMap, _.map(parsed.order, 'expression'), expressionToJsonLd],
    '@limit' : parsed.limit,
    '@offset' : parsed.offset
  }, pass(function (jsonRql) {
    return cb(false, jsonRql, parsed);
  }, cb));
};
