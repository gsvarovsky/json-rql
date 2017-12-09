var _ = require('lodash'),
    _util = require('../lib/util'),
    _async = require('async'),
    pass = require('pass-error'),
    sparqlGenerator = new (require('sparqljs').Generator)(),
    tempPredicate = 'http://json-rql.org/predicate',
    tempObject = 'http://json-rql.org/object';

module.exports = function toSparql(jrql, cb/*(err, sparql, parsed)*/) {
    // Prefixes can be applied with either a prefixes hash, or a JSON-LD context hash, both at top level.
    var context = jrql['@context'] || {};

    function toTriples(jsonld, allowFilters, cb/*(err, [triple], [filter])*/) {
        !_.isArray(jsonld) || (jsonld = { '@graph' : jsonld });
        var filters = [];
        // Clone the json-ld to maintain our non-mutation contract, and capture any in-line filters
        jsonld = allowFilters ? _.cloneDeepWith(_.omit(jsonld, '@filter', '@bind'), function (maybeFilter) {
            var key = _util.getOnlyKey(_.omit(maybeFilter, '@id'));
            if (_util.operators[key] && (!maybeFilter['@id'] || _util.matchVar(maybeFilter['@id']))) {
                var variable = maybeFilter['@id'] || _util.newVariable();
                filters.push(_util.kvo(key, [variable, maybeFilter[key]]));
                return variable;
            }
        }) : _.cloneDeep(jsonld);
        var localContext = _.merge(jsonld['@context'], context);
        _util.toTriples(_util.hideVars(_.set(jsonld, '@context', localContext)), pass(function (triples) {
            cb(false, _.map(triples, function (triple) {
                return _.mapValues(triple, _util.unhideVar);
            }), filters);
        }, cb));
    }

    function operationAst(operator, args) {
        return { type : 'operation', operator : operator, args : args };
    }

    function expressionToSparqlJs(expr, cb/*(err, ast)*/) {
        var key = _util.getOnlyKey(expr);
        if (key) {
            var argTemplate = [_async.map, _.castArray(expr[key]), expressionToSparqlJs];
            if (_util.operators[key]) {
                // An operator expression
                return _util.ast(operationAst(_util.operators[key].sparql, argTemplate), pass(function (operation) {
                    if (_util.operators[key].associative) {
                        while (operation.args.length > 2)
                            operation.args = _.concat(operationAst(operation.operator, _.take(operation.args, 2)),
                                _.drop(operation.args, 2));
                    }
                    return cb(false, operation);
                }, cb));
            } else if (!key.startsWith('@')) {
                // A function expression
                return toTriples(_util.kvo(key, tempObject), false, pass(function (triples) {
                    return _util.ast({
                        type : 'functionCall',
                        function : triples[0].predicate,
                        args : argTemplate,
                        distinct : false // TODO what is this anyway
                    }, cb);
                }, cb));
            }
        }
        // JSON-LD value e.g. literal, [literal], { @id : x } or { @value : x, @language : y }
        return toTriples(_util.kvo(tempPredicate, expr), false, pass(function (triples) {
            return cb(false, _.isArray(expr) ? _.map(triples, 'object') : triples[0].object);
        }, cb));
    }

    function clauseToSparqlJs(clause, cb/*(err, ast)*/) {
        if (_.isArray(clause)) {
            return _async.reduce(clause, { ngItems : [], patterns : [] }, function ($, item, cb) {
                var group = _.pick(item, '@graph', '@bind', '@filter', '@union', '@optional');
                if (_.isEmpty(group)) {
                    return cb(false, _.set($, 'ngItems', $.ngItems.concat(item)));
                } else {
                    // Bank any non-group patterns gathered so far
                    return groupToSparqlJs($.ngItems, pass(function (ngPatterns) {
                        // Create a group pattern
                        return _util.ast({ type : 'group', patterns : [groupToSparqlJs, group] }, pass(function (gp) {
                            return cb(false, { ngItems : [], patterns : $.patterns.concat(ngPatterns).concat(gp) });
                        }, cb));
                    }, cb));
                }
            }, pass(function ($) {
                return groupToSparqlJs($.ngItems, pass(function (ngPatterns) {
                    // Inline any trailing group
                    var patterns = $.patterns.concat(ngPatterns);
                    if (_.isMatch(_.last(patterns), { type : 'group' }))
                        patterns = _.initial(patterns).concat(_.last(patterns).patterns);
                    return cb(false, patterns);
                }, cb));
            }, cb));
        } else {
            return groupToSparqlJs(clause, cb);
        }
    }

    function groupToSparqlJs(clause, cb/*(err, ast)*/) {
        return _async.auto({
            bgp : function (cb) {
                // Try to turn the whole clause into a BGP
                return toTriples(clause, true, pass(function (triples, filters) {
                    // Pollute the bgp clause slightly with the filters (ignored by sparql.js)
                    return cb(false, !_.isEmpty(triples) && { type : 'bgp', triples : triples, filters : filters });
                }, cb));
            },
            bind : clause['@bind'] ? function (cb) {
                return _async.mapValues(clause['@bind'], function (expr, variable, cb) {
                    return _util.ast({ type : 'bind', variable : variable, expression : [expressionToSparqlJs, expr] }, cb);
                }, pass(function (binds) { cb(false, _.values(binds)); }, cb));
            } : _async.constant(),
            filters : ['bgp', function ($, cb) {
                // Combine in-line filters with explicit filters
                var allFilters = _.compact(_.concat(_.get($.bgp, 'filters'), _.castArray(clause['@filter'])));
                return _async.map(allFilters, function (expr, cb) {
                    return _util.ast({ type : 'filter', expression : [expressionToSparqlJs, expr] }, cb);
                }, cb);
            }],
            optionals : clause['@optional'] ? function (cb) {
                return _async.map(_.castArray(clause['@optional']), function (clause, cb) {
                    return _util.ast({ type : 'optional', patterns : [groupToSparqlJs, clause] }, cb);
                }, cb);
            } : _async.constant(),
            unions : clause['@union'] ? function (cb) {
                return _util.ast({
                    type : 'union',
                    patterns : [_async.map, clause['@union'], function (group, cb) {
                        return _util.ast({ type : 'group', patterns : [groupToSparqlJs, group] }, cb);
                    }]
                }, cb)
            } : _async.constant()
        }, pass(function ($) {
            return cb(false, _.compact(_.flatten(_.values($))));
        }, cb));
    }

    var type = !_.isEmpty(_.pick(jrql, '@select', '@distinct', '@construct', '@describe')) ? 'query' :
        !_.isEmpty(_.pick(jrql, '@insert', '@delete')) ? 'update' : undefined;

    return type ? _util.ast({
        type : type,
        queryType : jrql['@select'] || jrql['@distinct'] ? 'SELECT' :
            jrql['@construct'] ? 'CONSTRUCT' : jrql['@describe'] ? 'DESCRIBE' : undefined,
        variables : jrql['@select'] || jrql['@distinct'] || jrql['@describe'] ?
            _.castArray(jrql['@select'] || jrql['@distinct'] || jrql['@describe']) : undefined,
        distinct : !!jrql['@distinct'] || undefined,
        template : jrql['@construct'] ? [toTriples, jrql['@construct'], false] : undefined,
        where : jrql['@where'] && type === 'query' ? [clauseToSparqlJs, jrql['@where']] : undefined,
        updates : type === 'update' ? function (cb) {
            return _util.ast({
                updateType : 'insertdelete',
                insert : jrql['@insert'] ? [clauseToSparqlJs, jrql['@insert']] : [],
                delete : jrql['@delete'] ? [clauseToSparqlJs, jrql['@delete']] : [],
                where : jrql['@where'] ? [clauseToSparqlJs, jrql['@where']] : []
            }, _.castArray, cb);
        } : undefined,
        order : jrql['@orderBy'] ? [_async.map, _.castArray(jrql['@orderBy']), function (expr, cb) {
            return _util.ast({
                expression : [expressionToSparqlJs, expr['@asc'] || expr['@desc'] || expr],
                descending : expr['@desc'] ? true : undefined
            }, cb);
        }] : undefined,
        limit : jrql['@limit'],
        offset : jrql['@offset']
    }, pass(function (sparqljs) {
        try {
            return cb(false, sparqlGenerator.stringify(sparqljs), sparqljs);
        } catch (e) {
            return cb(e, null, sparqljs);
        }
    }, cb)) : cb('Unsupported type');
};
