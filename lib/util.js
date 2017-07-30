var _ = require('lodash'),
    _n3 = require('n3'),
    _jsonld = require('jsonld'),
    _async = require('async'),
    pass = require('pass-error'),
    hiddenVarPrefix = 'http://json-rql.org/var#';

var _util = module.exports = {
    kvo : function (key, value) {
        var object = {};
        object[key] = value;
        return object;
    },

    matchVar : function (value) {
        return _.isString(value) && /^\?(\w+)$/g.exec(value);
    },

    hideVar : function (value) {
        var match = _util.matchVar(value);
        return match ? hiddenVarPrefix + match[1] : value;
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

    isHiddenVar : function (value) {
        return _.isString(value) && value.startsWith(hiddenVarPrefix);
    },

    unhideVar : function (value) {
        return _util.isHiddenVar(value) ? '?' + value.substr(hiddenVarPrefix.length) : value;
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

    operators : require('./operators.json'),

    toJsonLd : function (triples, context, cb/*(err, jsonld)*/) {
        var writer = _n3.Writer({ format : 'N-Quads' });
        _.each(triples, _.bind(_.unary(writer.addTriple), writer));
        return writer.end(pass(function (nquads) {
            return _jsonld.fromRDF(nquads, {
                format : 'application/nquads',
                useNativeTypes : true
            }, pass(function (expanded) {
                return _jsonld.compact(expanded, context, cb);
            }, function (err) {
                err.nquads = nquads.split('\n');
                err.context = context;
                return cb(err);
            }));
        }, cb));
    },

    toTriples : function (jsonld, cb/*(err, [triples], prefixes)*/) {
        return _jsonld.toRDF(jsonld, { format : 'application/nquads' }, pass(function (rdf) {
            var triples = [];
            _n3.Parser().parse(rdf, pass(function (triple, prefixes) {
                return triple ? triples.push(triple) : cb(false, triples, prefixes);
            }, cb));
        }, cb));
    },

    inline : function (graph, tlos, findTlo, toInlined) {
        function inline(o) {
            if (_.isObject(o)) { // Including arrays
                _.each(_.without(_.keys(o), '__refs'), function (k) {
                    inline(o[k]);
                    var tlo = findTlo(o[k]);
                    if (tlo && o[k] !== tlo) {
                        // Add this location to the inlined references
                        tlo.__refs = (tlo.__refs || []).concat({ o : o, k : k });
                    }
                });
            }
        }
        inline(graph);

        for (var i = 0; i < tlos.length; i++) {
            var tlo = tlos[i], refs = tlo.__refs;
            delete tlo.__refs;
            if (refs && refs.length === 1) {
                // There is one inlineed reference to this TLO. Remove it from the top level
                tlos.splice(i--, 1);
                // and replace the reference
                refs[0].o[refs[0].k] = toInlined(tlo);
            }
        }
        return _util.unArray(graph);
    },

    inlineGraph : function (graph) {
        return _util.inline(graph, _.castArray(graph), function findTlo(inlineedValue) {
            return inlineedValue && inlineedValue['@id'] && _.find(graph, { '@id' : inlineedValue['@id'] });
        }, _.identity);
    },

    inlineFilters : function (graph, filters) {
        return _util.inline(graph, filters, function findTlo(v) {
            return v && _.find(filters, function hasMatchingFirstParameter(filter) {
                return _.every(filter, function (parameters) { return _.first(parameters) === v });
            });
        }, function toInlined(tlo) {
            return _.mapValues(tlo, function (parameters) {
                return _util.unArray(_.tail(parameters));
            });
        });
    },

    unArray : function (array) {
        return array.length === 1 ? array[0] : array;
    },

    miniMap : function (collection, iteratee, cb/*(err, maybeArray)*/) {
        return !_.isEmpty(collection) ? _async.map(collection, iteratee, pass(function (result) {
            cb(false, _util.unArray(result));
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
    }
};
