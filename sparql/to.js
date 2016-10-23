var _ = require('lodash'),
    _jrql = require('../index'),
    _async = require('async'),
    pass = require('pass-error'),
    sparqlGenerator = new (require('sparqljs').Generator)(),
    tempPredicate = 'http://json-rql.org/predicate';

module.exports = function (jrql, cb/*(err, sparql, parsed)*/) {
  // Prefixes can be applied with either a prefixes hash, or a JSON-LD context hash, both at top level.
  var context = jrql['@context'] || {};

  function toTriples(jsonld, cb/*(err, [triple])*/) {
    jsonld['@context'] = _.merge(jsonld['@context'], context);
    _jrql.toTriples(_jrql.hideVars(jsonld), pass(function (triples) {
      cb(false, _.map(triples, function (triple) {
        return _.mapValues(triple, _jrql.unhideVar);
      }));
    }, cb));
  }

  function toBgp(jsonld, cb/*(err, { type : 'bgp', triples : [] })*/) {
    return _jrql.ast({ type : 'bgp', triples : [toTriples, jsonld] }, cb);
  }

  function expressionToSparqlJs(expr, cb/*(err, ast)*/) {
    var operator = _.isObject(expr) && _.size(expr) === 1 && _.first(_.keys(expr));
    if (operator && _.includes(_.values(_jrql.operators), operator)) {
      // An operator expression
      return _jrql.ast({
        type : 'operation',
        operator : _.invert(_jrql.operators)[operator],
        args : [_async.map, expr[operator], expressionToSparqlJs]
      }, cb);
    } else {
      // JSON-LD value e.g. literal, [literal], { @id : x } or { @value : x, @language : y }
      var jsonld = { '@context' : context };
      jsonld[tempPredicate] = expr;
      return toTriples(jsonld, pass(function (triples) {
        return triples.length === 1 ?
          // Counteract JSON-LD unarraying a unary array
          cb(false, _.isArray(expr) ? _.castArray(triples[0].object) : triples[0].object) :
          cb('Cannot parse ' + expr);
      }, cb));
    }
  }

  function clauseToSparqlJs(clause, cb/*(err, ast)*/) {
    if (clause['@id']) {
      // Straight JSON-LD object. Return array with one bgp.
      return toBgp(clause, pass(function (result) { cb(false, [result]); }, cb));
    } else {
      return _async.concat(_.keys(clause), function (key, cb) {
        switch (key) {
          case '@graph': return toBgp(_.pick(clause, '@graph'), cb);
          case '@filter': return _async.map(_.castArray(clause[key]), function (expr, cb) {
            return _jrql.ast({ type : 'filter', expression : [expressionToSparqlJs, expr] }, cb);
          }, cb);
          case '@optional': return _jrql.ast({
            type : 'optional', patterns : [clauseToSparqlJs, clause[key]]
          }, cb);
          // TODO case '@union':
          default: return cb('Unsupported clause key: ' + key + ' in ' + JSON.stringify(clause));
        }
      }, cb);
    }
  }

  var type = !_.isEmpty(_.pick(jrql, '@select', '@distinct', '@construct', '@describe')) ? 'query' :
             !_.isEmpty(_.pick(jrql, '@insert', '@delete')) ? 'update' : undefined;

  return type ? _jrql.ast({
    type : type,
    queryType : jrql['@select'] || jrql['@distinct'] ? 'SELECT' :
      jrql['@construct'] ? 'CONSTRUCT' :
      jrql['@describe'] ? 'DESCRIBE' : undefined,
    variables : jrql['@select'] || jrql['@distinct'],
    distinct : !!jrql['@distinct'] || undefined,
    template : jrql['@construct'] ? [toTriples, jrql['@construct']] : undefined,
    where : jrql['@where'] && type === 'query' ? [clauseToSparqlJs, jrql['@where']] : undefined,
    updates : type === 'update' ? function (cb) {
      return _jrql.ast({
        updateType : 'insertdelete',
        insert : jrql['@insert'] ? [clauseToSparqlJs, jrql['@insert']] : [],
        delete : jrql['@delete'] ? [clauseToSparqlJs, jrql['@delete']] : [],
        where : jrql['@where'] ? [clauseToSparqlJs, jrql['@where']] : []
      }, _.castArray, cb);
    } : undefined,
    order : jrql['@orderBy'] ? [_async.map, _.castArray(jrql['@orderBy']), function (expr, cb) {
      // TODO direction
      return _jrql.ast({ expression : [expressionToSparqlJs, expr] }, cb);
    }] : undefined,
    limit : jrql['@limit'],
    offset : jrql['@offset']
  }, pass(function (sparqljs) {
    return cb(false, sparqlGenerator.stringify(sparqljs), sparqljs);
  }, cb)) : cb('Unsupported type');
};
