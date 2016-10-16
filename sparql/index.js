var _ = require('lodash'),
    _n3 = require('n3'),
    _jsonld = require('jsonld'),
    _async = require('async'),
    pass = require('pass-error'),
    sparqlGenerator = new (require('sparqljs').Generator)(),
    sparqlParser = new (require('sparqljs').Parser)(),
    hiddenVarPrefix = 'http://json-rql.org/var#';

var toRdf = exports.toRdf = function (jsonld, cb/*(err, rdf)*/) {
    return _jsonld.toRDF(jsonld, { format : 'application/nquads' }, cb);
};

var isJsonLd = exports.isJsonLd = function (obj) {
    return obj && (obj['@id'] || obj['@graph']);
};

function isVar(value) {
    return _.isString(value) && /^\?(\w+)$/g.exec(value);
}

function hideVar(value) {
    var match = isVar(value);
    return match ? '?:' + match[1] : value;
}

function hideVars(value) {
    if (_.isArray(value)) {
        return _.map(value, hideVars);
    } else if (_.isObject(value)) {
        return _.transform(value, function (rtn, value, key) {
            rtn[hideVar(key)] = _.isObject(value) || !key.startsWith('@') ? hideVars(value) : hideVar(value);
            return rtn;
        }, {});
    } else if (isVar(value)) {
        return { '@id' : hideVar(value) }
    } else {
        return value;
    }
}

function isHiddenVar(value) {
  return _.isString(value) && value.startsWith(hiddenVarPrefix);
}

function unhideVar(value) {
    return isHiddenVar(value) ? '?' + value.substr(hiddenVarPrefix.length) : value;
}

function unhideVars(value) {
  if (_.isArray(value)) {
    return _.map(value, unhideVars);
  } else if (_.isObject(value)) {
    if (_.isEqual(_.keys(value), ['@id']) && isHiddenVar(value['@id'])) {
      return unhideVar(value['@id']);
    } else {
      return _.transform(value, function (o, v, k) {
        o[unhideVar(k)] = unhideVars(v);
        return o;
      });
    }
  } else {
    return unhideVar(value);
  }
}

exports.toSparql = function (jsonRql, cb/*(err, sparql)*/) {
    // Prefixes can be applied with either a prefixes hash, or a JSON-LD context hash, both at top level.
    // Also include the prefix used for hiding '?x' variables from the JSON-LD processor.
    var context = _.merge(jsonRql['@context'] || {}, jsonRql.prefixes, { '?' : hiddenVarPrefix });

    /**
     * Correct embedded JSON-LD (sans @context) to N3 triples
     */
    function toBgp(maybeJsonLd, cb/*(err, { type : 'bgp', triples : [] })*/) {
        if (isJsonLd(maybeJsonLd)) {
            var bgp = { type : 'bgp', triples : [] };
            maybeJsonLd['@context'] = _.merge(maybeJsonLd['@context'], context);
            return toRdf(hideVars(maybeJsonLd), pass(function (rdf) {
                _n3.Parser().parse(rdf, pass(function (triple) {
                    if (triple) {
                        bgp.triples = bgp.triples.concat(_.mapValues(triple, unhideVar));
                    } else {
                        // Note, we discard the prefixes, becuase the n3 format is expanded
                        cb(false, bgp);
                    }
                }, cb));
            }, cb));
        } else {
            return cb(false, maybeJsonLd);
        }
    }

    function clauseCorrect(clause) {
        return function (ast, cb/*(err, ast)*/) {
            if (isJsonLd(ast[clause])) {
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

function optimiseTlos(tlos) {
  function optimise(o) {
    if (_.isObject(o)) {
      _.each(_.keys(o), function (k) {
        optimise(o[k]);
        if (o[k] && o[k]['@id']) {
          var tlo = _.find(tlos, { '@id' : o[k]['@id'] });
          if (tlo && o[k] !== tlo) {
            o[k] = _.merge(tlo, o[k]);
            o[k].__refs = (o[k].__refs || 0) + 1;
          }
        }
      });
    }
  }
  optimise(tlos);
  var optimised = _.reject(tlos, { __refs : 1 });
  _.each(tlos, function (o) {
    delete o.__refs;
  });
  return optimised;
}

function toJsonLd(prefixes, clauses, cb) {
  var clausesByType = _.groupBy(clauses, 'type'), nothing = _async.constant();
  return _async.auto({
    '@graph' : !_.isEmpty(clausesByType.bgp) ? function (cb) {
      var writer = _n3.Writer({ format: 'N-Quads' });
      _.each(_.flatten(_.map(clausesByType.bgp, 'triples')), function (triple) {
        writer.addTriple(_.mapValues(triple, function (value, key) {
          var match = isVar(value);
          return match ? hiddenVarPrefix + match[1] : value;
        }));
      });
      return writer.end(pass(function (nquads) {
        return _jsonld.fromRDF(nquads, { format: 'application/nquads' }, function (err, expanded) {
          _jsonld.compact(expanded, prefixes, pass(function (compacted) {
            compacted = _.omit(compacted, '@context');
            // Optimise away redundant top-level objects
            compacted = compacted['@graph'] ? optimiseTlos(compacted['@graph']) : compacted;
            // Unhide hidden subjects and predicates
            cb(false, unhideVars(compacted));
          }, cb));
        });
      }, cb));
    } : nothing
  }, pass(function (result) {
    // If a graph is the only thing we have, flatten it
    return cb(false, _.isEqual(_.keys(result), ['@graph']) ? result['@graph'] : result);
  }, cb));
}

exports.toJsonRql = function (sparql, cb/*(err, jsonRql)*/) {
  var parsed = sparqlParser.parse(sparql), nothing = _async.constant();
  _async.auto({
    '@context' : !_.isEmpty(parsed.prefixes) ? _async.constant(parsed.prefixes) : nothing,
    '@construct' : parsed.queryType === 'CONSTRUCT' ? _async.apply(toJsonLd, parsed.prefixes, [{
      type : 'bgp', triples : parsed.template
    }]) : nothing,
    '@select' : parsed.queryType === 'SELECT' ? _async.constant(parsed.variables) : nothing,
    '@where' : parsed.where ? _async.apply(toJsonLd, parsed.prefixes, parsed.where) : nothing
  }, pass(function (jsonRql) {
    return cb(false, _.set(jsonRql, '__parsed', parsed));
  }, cb));
};
