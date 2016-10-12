const _ = require('lodash'),
    _n3 = require('n3'),
    _jsonld = require('jsonld'),
    _async = require('async'),
    pass = require('pass-error'),
    sparqlGenerator = new (require('sparqljs').Generator)(),
    hiddenVarPrefix = 'http://json-rql.org/var#';

const toRdf = exports.toRdf = function (jsonld, cb/*(err, rdf)*/) {
    return _jsonld.toRDF(jsonld, { format : 'application/nquads' }, cb);
};

const isJsonLd = exports.isJsonLd = function (obj) {
    return obj && (obj['@id'] || obj['@graph']);
};

exports.toSparql = function (jsonRql, cb/*(err, sparql)*/) {
    // Prefixes can be applied with either a prefixes hash, or a JSON-LD context hash, both at top level.
    // Also include the prefix used for hiding '?x' variables from the JSON-LD processor.
    const context = _.merge(jsonRql['@context'] || {}, jsonRql.prefixes, { '?' : hiddenVarPrefix });

    function isVar(value) {
        return _.isString(value) && /^\?(\w+)$/g.exec(value);
    }

    function hideVar(value) {
        const match = isVar(value);
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

    function unhideVar(value) {
        return _.isString(value) && value.startsWith(hiddenVarPrefix) ? '?' + value.substr(hiddenVarPrefix.length) : value;
    }

    /**
     * Correct embedded JSON-LD (sans @context) to N3 triples
     */
    function toBgp(maybeJsonLd, cb/*(err, { type : 'bgp', triples : [] })*/) {
        if (isJsonLd(maybeJsonLd)) {
            const bgp = { type : 'bgp', triples : [] };
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