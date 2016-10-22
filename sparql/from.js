var _ = require('lodash'),
    _jrql = require('../index'),
    _async = require('async'),
    pass = require('pass-error'),
    sparqlParser = new (require('sparqljs').Parser)(),
    tempSubject = 'http://json-rql.org/subject',
    tempPredicate = 'http://json-rql.org/predicate';

module.exports = function (sparql, cb/*(err, jsonRql, parsed)*/) {
  var parsed = sparqlParser.parse(sparql), nothing = _async.constant();

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

  function clausesToJsonLd(clauses, cb) {
    var clausesByType = _.groupBy(clauses, 'type');
    return _async.auto({
      '@graph' : !_.isEmpty(clausesByType.bgp) ? function (cb) {
        var triples = _(clausesByType.bgp).map('triples').flatten().map(function (triple) {
          return _.mapValues(triple, _jrql.hideVar);
        }).value();
        return _jrql.toJsonLd(triples, parsed.prefixes, pass(function (jsonld) {
          jsonld = _.omit(jsonld, '@context');
          // Optimise away redundant top-level objects
          jsonld = jsonld['@graph'] ? _jrql.nestGraph(jsonld['@graph']) : jsonld;
          // Unhide hidden subjects and predicates
          cb(false, _jrql.unhideVars(jsonld));
        }, cb));
      } : nothing,
      '@filter' : _async.apply(_jrql.miniMap, _.map(clausesByType.filter, 'expression'), expressionToJsonLd)
    }, pass(function (result) {
      // If a graph is the only thing we have, flatten it
      return cb(false, _.isEqual(_.keys(_.pickBy(result)), ['@graph']) ? result['@graph'] : result);
    }, cb));
  }

  _async.auto({
    '@context' : !_.isEmpty(parsed.prefixes) ? _async.constant(parsed.prefixes) : nothing,
    '@construct' : parsed.queryType === 'CONSTRUCT' ? _async.apply(clausesToJsonLd, [{
      type : 'bgp', triples : parsed.template
    }]) : nothing,
    '@select' : parsed.queryType === 'SELECT' && !parsed.distinct ? _async.constant(parsed.variables) : nothing,
    '@distinct' : parsed.queryType === 'SELECT' && parsed.distinct ? _async.constant(parsed.variables) : nothing,
    '@where' : parsed.where ? _async.apply(clausesToJsonLd, parsed.where) : nothing,
    '@order' : _async.apply(_jrql.miniMap, _.map(parsed.order, 'expression'), expressionToJsonLd),
    '@limit' : parsed.limit ? _async.constant(parsed.limit) : nothing
  }, pass(function (jsonRql) {
    return cb(false, jsonRql, parsed);
  }, cb));
};
