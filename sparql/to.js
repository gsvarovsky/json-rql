var _ = require('lodash'),
    _jrql = require('../index'),
    _async = require('async'),
    pass = require('pass-error'),
    sparqlGenerator = new (require('sparqljs').Generator)();

module.exports = function (jsonRql, cb/*(err, sparql)*/) {
  // Prefixes can be applied with either a prefixes hash, or a JSON-LD context hash, both at top level.
  // Also include the prefix used for hiding '?x' variables from the JSON-LD processor.
  var context = _.merge(jsonRql['@context'] || {}, jsonRql.prefixes);

  /**
   * Correct embedded JSON-LD (sans @context) to N3 triples in a bgp-type clause
   */
  function toBgp(maybeJsonLd, cb/*(err, { type : 'bgp', triples : [] })*/) {
    if (_jrql.isJsonLd(maybeJsonLd)) {
      var bgp = { type : 'bgp', triples : [] };
      maybeJsonLd['@context'] = _.merge(maybeJsonLd['@context'], context);
      // Note, we discard the prefixes, becuase the n3 format is expanded
      _jrql.toTriples(_jrql.hideVars(maybeJsonLd), pass(function (triples) {
        bgp.triples = _.map(triples, function (triple) {
          return _.mapValues(triple, _jrql.unhideVar);
        });
        cb(false, bgp);
      }, cb));
    } else {
      return cb(false, maybeJsonLd);
    }
  }

  function clauseCorrect(clause) {
    return function (ast, cb/*(err, ast)*/) {
      if (_jrql.isJsonLd(ast[clause])) {
        // Direct JSON-LD. Expand to singleton array of BGP.
        return toBgp(ast[clause], pass(function (bgp) {
          return cb(false, _.set(ast, clause, [bgp]));
        }, cb));
      } else if (_.isObject(ast[clause])) {
        // Array of mixed clauses. Map to BGPs.
        return _async.map(_.castArray(ast[clause]), toBgp, pass(function (corrected) {
          return cb(false, _.set(ast, clause, corrected));
        }, cb));
      } else {
        return cb(false, ast);
      }
    };
  }

  // Apply some useful defaults
  jsonRql = _.defaults(jsonRql, { type : 'query' });
  if (jsonRql.type === 'query') {
    jsonRql = _.defaults(jsonRql, { queryType : 'SELECT' });
  } else if (jsonRql.type === 'update') {
    jsonRql.updates = _.castArray(jsonRql.updates);
    jsonRql.updates = _.map(jsonRql.updates, function (update) {
      return _.defaults(update, { updateType : 'insertdelete', insert : [], delete : [] });
    });
  }

  // If the clauses contain JSON-LD, expand them to bgp
  _async.seq(
    clauseCorrect('template'),
    clauseCorrect('where')
  )(jsonRql, pass(function (jsonRql) {
    _async.map(jsonRql.updates, _async.seq(
      clauseCorrect('delete'),
      clauseCorrect('insert'),
      clauseCorrect('where')), pass(function (updates) {
      jsonRql = _.set(jsonRql, 'updates', updates);
      cb(false, sparqlGenerator.stringify(_.omit(jsonRql, '@context')));
    }, cb));
  }, cb));
};
