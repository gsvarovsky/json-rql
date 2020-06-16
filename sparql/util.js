var _ = require('lodash'),
    _n3 = require('n3'),
    _async = require('async'),
    callbackify = require('util').callbackify,
    genVarName = require('gen-id')('xxxx'),
    pass = require('pass-error'),
    hiddenVarPrefix = 'http://json-rql.org/var#';

_util = module.exports = _.assign({
    kvo : function (key, value, object) {
        object = object || {};
        object[key] = value;
        return object;
    },

    matchVar: function (value) {
        if (_.isString(value)) {
            var match = /^\?([\d\w]+)$/g.exec(value);
            return match != null && match[1];
        } else if (_util.isTerm(value, 'Variable')) {
            return value.value;
        } else {
            return false;
        }
    },

    hideVar: function (value) {
        if (_util.isTerm(value, 'Variable')) {
            return {
                termType: 'NamedNode',
                value: hiddenVarPrefix + value.value
            }
        } else {
            var varName = _util.matchVar(value);
            return varName ? hiddenVarPrefix + varName : value;
        }
    },

    hideVars : function (value) {
        if (_.isArray(value)) {
            return _.map(value, _util.hideVars);
        } else if (_.isObject(value)) {
            return _.transform(value, function (rtn, value, key) {
                rtn[_util.hideVar(key)] = _.isObject(value) || !key.startsWith('@') ? _util.hideVars(value) : _util.hideVar(value);
                return rtn;
            }, {});
        } else if (_util.matchVar(value)) {
            return { '@id' : _util.hideVar(value) }
        } else {
            return value;
        }
    },

    isTerm : function (value, termType) {
        return _.isObject(value) && (termType == null ?
            _.isString(value.termType) : value.termType === termType);
    },

    isHiddenVar : function (value) {
        return (_.isString(value) && value.startsWith(hiddenVarPrefix)) ||
            (_util.isTerm(value, 'NamedNode') && value.value.startsWith(hiddenVarPrefix));
    },

    unhideVar : function (value) {
        return _util.isHiddenVar(value) ? _util.isTerm(value, 'NamedNode') ? {
            termType: 'Variable',
            value: value.value.substr(hiddenVarPrefix.length)
        } : _util.varExpr(value.substr(hiddenVarPrefix.length)) : value;
    },

    varExpr: function (varName) {
        return '?' + varName;
    },

    unhideVars : function (value) {
        if (_.isArray(value)) {
            return _.map(value, _util.unhideVars);
        } else if (_.isObject(value)) {
            if (_.isEqual(_.keys(value), ['@id']) && _util.isHiddenVar(value['@id'])) {
                return _util.unhideVar(value['@id']);
            } else {
                return _.transform(value, function (o, v, k) {
                    o[_util.unhideVar(k)] = _util.unhideVars(v);
                    return o;
                });
            }
        } else {
            return _util.unhideVar(value);
        }
    },

    getOnlyKey : function (expr) {
        return _.isPlainObject(expr) && _.size(expr) === 1 && _.first(_.keys(expr));
    },

    toContext : function (prefixes) {
        return _.mapKeys(prefixes, function (fix, pre) {
            return pre === '' ? '@vocab' : pre;
        });
    },

    /**
     * jsonld now only supports promisified operations
     */
    fromRDF: callbackify(require('jsonld').fromRDF),
    toRDF: callbackify(require('jsonld').toRDF),
    compact: callbackify(require('jsonld').compact),

    toJsonLd : function (triples, prefixes, cb/*(err, jsonld)*/) {
        var writer = new _n3.Writer({ format : 'N-Quads' }), context = _util.toContext(prefixes);
        writer.addQuads(triples);
        return writer.end(pass(function (nquads) {
            return _util.fromRDF(nquads, {
                format : 'application/nquads',
                useNativeTypes : true
            }, pass(function (expanded) {
                return _util.compact(expanded, context, cb);
            }, function (err) {
                err.nquads = nquads.split('\n');
                err.context = context;
                return cb(err);
            }));
        }, cb));
    },

    toTriples : function (jsonld, cb/*(err, [triples], prefixes)*/) {
        return _util.toRDF(jsonld, { format : 'application/nquads' }, pass(function (rdf) {
            var triples = [];
            (new _n3.Parser()).parse(rdf.trim(), pass(function (triple, prefixes) {
                return triple ? triples.push(triple) : cb(false, triples, prefixes);
            }, cb));
        }, cb));
    },

    inline : function (tree, tlos, findTlo, toInlined) {
        function countTloRefs(o) {
            if (_.isObject(o)) { // Including arrays
                _.each(_.without(_.keys(o), '__refs'), function (k) {
                    countTloRefs(o[k]);
                    var tlo = findTlo(o[k]);
                    if (tlo && o[k] !== tlo) {
                        // Add this location to the inlined references
                        tlo.__refs = (tlo.__refs || []).concat({ o : o, k : k });
                    }
                });
            }
        }
        countTloRefs(tree);

        for (var i = 0; i < tlos.length; i++) {
            var tlo = tlos[i], refs = tlo.__refs;
            delete tlo.__refs;
            if (refs && refs.length === 1) {
                // There is one inlined reference to this TLO. Remove it from the top level
                tlos.splice(i--, 1);
                // and replace the reference
                refs[0].o[refs[0].k] = toInlined(tlo);
            }
        }
        return _util.unArray(tree);
    },

    inlineGraph : function (graph) {
        return _util.inline(graph, _.castArray(graph), function findTlo(v) {
            return v && v['@id'] && _.find(graph, { '@id' : v['@id'] });
        }, _.identity);
    },

    inlineFilters : function (graph, filters) {
        return _util.inline(graph, filters, function findTlo(v) {
            return _util.matchVar(v) && _.find(filters, function hasMatchingVariable(filter) {
                return _.first(filter[_util.getOnlyKey(_.omit(filter, '__refs'))]) === v;
            });
        }, function toInlined(filter) {
            var operator = _util.getOnlyKey(filter);
            return _util.kvo(operator, _util.unArray(_.tail(filter[operator])), { '@id' : _.first(filter[operator]) });
        });
    },

    unArray : function (array) {
        return _.isArray(array) && array.length === 1 ? array[0] : array;
    },

    miniMap : function (collection, iteratee, cb/*(err, maybeArray)*/) {
        return !_.isEmpty(collection) ? _async.map(collection, iteratee, pass(function (result) {
            return cb(false, _util.unArray(result));
        }, cb)) : _async.constant()(cb);
    },

    ast : function (template, transform, cb/*(err, made)*/) {
        cb || ((cb = transform) && (transform = _.identity));
        return _async.auto(_.mapValues(template, function (value) {
            if (_.isFunction(value)) {
                return value;
            } else if (_.isArray(value) && _.isFunction(value[0])) {
                return _async.apply.apply(this, value);
            } else {
                return _async.constant(value);
            }
        }), pass(function (made) {
            return cb(false, transform(_.pickBy(made)));
        }, cb));
    },

    newVariable : function () {
        return '?jrql_' + genVarName.generate();
    }
}, require('../keywords'));
