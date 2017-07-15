var _ = require('lodash'),
    _n3 = require('n3'),
    _jsonld = require('jsonld'),
    _async = require('async'),
    pass = require('pass-error'),
    hiddenVarPrefix = 'http://json-rql.org/var#';

var _util = module.exports = {
    matchVar: function (value) {
        return _.isString(value) && /^\?(\w+)$/g.exec(value);
    },

    hideVar: function (value) {
        var match = _util.matchVar(value);
        return match ? hiddenVarPrefix + match[1] : value;
    },

    hideVars: function (value) {
        if (_.isArray(value)) {
            return _.map(value, _util.hideVars);
        } else if (_.isObject(value)) {
            return _.transform(value, function (rtn, value, key) {
                rtn[_util.hideVar(key)] = _.isObject(value) || !key.startsWith('@') ? _util.hideVars(value) : _util.hideVar(value);
                return rtn;
            }, {});
        } else if (_util.matchVar(value)) {
            return {'@id': _util.hideVar(value)}
        } else {
            return value;
        }
    },

    isHiddenVar: function (value) {
        return _.isString(value) && value.startsWith(hiddenVarPrefix);
    },

    unhideVar: function (value) {
        return _util.isHiddenVar(value) ? '?' + value.substr(hiddenVarPrefix.length) : value;
    },

    unhideVars: function (value) {
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

    operators: {
        '>': '@gt',
        '<': '@lt',
        '>=': '@gte',
        '<=': '@lte',
        '!': '@not',
        '!=': '@neq',
        '&&': '@and',
        '+': '@plus',
        '-': '@minus',
        'bound': '@bound',
        'regex': '@regex',
        'in': '@in',
        'lang' : '@lang',
        'langmatches' : '@langmatches',
        'descending' : '@desc',
        'ascending' : '@asc'
    },

    toJsonLd: function (triples, context, cb/*(err, jsonld)*/) {
        var writer = _n3.Writer({format: 'N-Quads'});
        _.each(triples, _.bind(_.unary(writer.addTriple), writer));
        return writer.end(pass(function (nquads) {
            return _jsonld.fromRDF(nquads, {
                format: 'application/nquads',
                useNativeTypes: true
            }, pass(function (expanded) {
                return _jsonld.compact(expanded, context, cb);
            }, function (err) {
                err.nquads = nquads.split('\n');
                err.context = context;
                return cb(err);
            }));
        }, cb));
    },

    toTriples: function (jsonld, cb/*(err, [triples], prefixes)*/) {
        return _jsonld.toRDF(jsonld, {format: 'application/nquads'}, pass(function (rdf) {
            var triples = [];
            _n3.Parser().parse(rdf, pass(function (triple, prefixes) {
                return triple ? triples.push(triple) : cb(false, triples, prefixes);
            }, cb));
        }, cb));
    },

    nestGraph: function (graph) {
        function nest(o) {
            if (_.isObject(o)) {
                _.each(_.keys(o), function (k) {
                    nest(o[k]);
                    if (o[k] && o[k]['@id']) {
                        var tlo = _.find(graph, {'@id': o[k]['@id']});
                        if (tlo && o[k] !== tlo) {
                            o[k] = _.merge(tlo, o[k]);
                            o[k].__refs = (o[k].__refs || 0) + 1;
                        }
                    }
                });
            }
        }

        nest(graph);
        for (var i = 0; i < graph.length; i++) {
            var tlo = graph[i], refs = tlo.__refs;
            delete tlo.__refs;
            if (refs === 1) {
                graph.splice(i--, 1);
            } else if (refs > 1) {
                graph[i] = _.cloneDeep(tlo);
                _.each(_.without(_.keys(tlo), '@id'), function (k) {
                    delete tlo[k]
                });
            }
        }
        return _util.unArray(graph);
    },

    unArray: function (array) {
        return array.length === 1 ? array[0] : array;
    },

    miniMap: function (collection, iteratee, cb/*(err, maybeArray)*/) {
        return !_.isEmpty(collection) ? _async.map(collection, iteratee, pass(function (result) {
            cb(false, _util.unArray(result));
        }, cb)) : _async.constant()(cb);
    },

    ast: function (template, transform, cb/*(err, made)*/) {
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
