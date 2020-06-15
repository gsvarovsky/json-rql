var _ = require('lodash'),
    _util = require('../lib/util'),
    _async = require('async'),
    pass = require('pass-error'),
    sparqlParser = new (require('sparqljs').Parser)(),
    tempSubject = { termType: 'NamedNode', value: 'http://json-rql.org/subject' },
    tempPredicate = { termType: 'NamedNode', value: 'http://json-rql.org/predicate' },
    tempObject = { termType: 'NamedNode', value: 'http://json-rql.org/object' };

module.exports = function toJsonRql(sparql, cb/*(err, jsonRql, parsed)*/) {
    var parsed = sparqlParser.parse(sparql), prefixes = parsed.prefixes;

    function operationToJsonLd(operator, args, cb) {
        return _util.miniMap(args, expressionToJsonLd, pass(function (jsonldArgs) {
            // Collapse any associative sub-clauses
            if (_.get(_util.operators[operator], 'associative') && _.isArray(jsonldArgs)) {
                jsonldArgs = _.flatMap(jsonldArgs, function (arg) {
                    return _util.getOnlyKey(arg) === operator ? _.values(arg)[0] : arg;
                });
            }
            return cb(false, _util.kvo(operator, jsonldArgs));
        }, cb));
    }

    function expressionToJsonLd(expr, cb/*(err, jsonld)*/) {
        var operator, tempTriples;
        if (_.isArray(expr) || _util.isTerm(expr)) {
            tempTriples = _.map(_.castArray(expr), function (e) {
                return { subject : tempSubject, predicate : tempPredicate, object : _util.hideVar(e) }
            });
            return _util.toJsonLd(tempTriples, prefixes, pass(function (jsonld) {
                return cb(false, _util.unhideVars(jsonld[tempPredicate.value]));
            }, cb));
        } else if (expr.type === 'operation') {
            operator = _.findKey(_util.operators, { sparql : expr.operator });
            return operator ? operationToJsonLd(operator, expr.args, cb) : cb('Unsupported operator: ' + expr.operator);
        } else if (expr.type === 'functionCall') {
            tempTriples = [{ subject : tempSubject, predicate : expr['function'], object : tempObject }];
            _util.toJsonLd(tempTriples, prefixes, pass(function (jsonld) {
                return operationToJsonLd(_.findKey(jsonld, { '@id' : tempObject.value }), expr.args, cb);
            }, cb));
        } else if (expr.type === 'aggregate') {
            operator = _.findKey(_util.operators, { sparql : expr.aggregation });
            return operator ? operationToJsonLd(operator, [expr.expression], cb) : cb('Unsupported aggregate: ' + expr.aggregation);
        } else {
            return cb('Unsupported expression: ' + expr.type || expr);
        }
    }

    function transformExprToJsonLd(v, _k, cb) {
        return expressionToJsonLd(v, cb);
    }

    function triplesToJsonLd(triples, cb) {
        return _util.toJsonLd(_.map(triples, function (triple) {
            return _.mapValues(triple, _util.hideVar);
        }), prefixes, pass(function (jsonld) {
            jsonld = _.omit(jsonld, '@context');
            // Optimise away redundant top-level objects
            jsonld = jsonld['@graph'] ? _util.inlineGraph(jsonld['@graph']) : jsonld;
            // Unhide hidden subjects and predicates
            cb(false, _util.unhideVars(jsonld));
        }, cb));
    }

    function variableExpressionToJsonLd(varExpr, cb) {
        if (_util.isTerm(varExpr, 'Variable')) {
            return _async.nextTick(cb, false, _util.varExpr(varExpr.value));
        } else if (_util.isTerm(varExpr, 'Wildcard')) {
            return _async.nextTick(cb, false, '*');
        } else if (varExpr.expression) {
            return expressionToJsonLd(varExpr.expression, pass(function (expr) {
                return cb(false, _util.kvo(_util.varExpr(varExpr.variable.value), expr));
            }, cb));
        } else {
            cb('Unrecognised variable expression type ' + varExpr);
        }
    }

    function valuesToJsonLd(varValues, cb) {
        // SPARQL.js leaves undefined values for UNDEF variable values
        return _async.mapValues(_.omitBy(varValues, _.isUndefined), transformExprToJsonLd, cb);
    }

    function groupsToJsonLd(groups, cb) {
        return _async.auto({
            byType : _async.constant(_.groupBy(groups, 'type')),
            groups : ['byType', function ($, cb) {
                return _async.map(_.map($.byType.group, 'patterns'), groupsToJsonLd, cb);
            }],
            queries : ['byType', function ($, cb) {
                return _async.map($.byType.query, clausesToJsonLd, cb);
            }],
            patterns : ['byType', function ($, cb) {
                return _util.ast({
                    '@graph' : $.byType.bgp ? [triplesToJsonLd, _.flatMap($.byType.bgp, 'triples')] : undefined,
                    '@bind' : $.byType.bind ? [_async.mapValues, _.transform($.byType.bind, function (bind, clause) {
                        bind[_util.varExpr(clause.variable.value)] = clause.expression;
                    }, {}), transformExprToJsonLd] : undefined,
                    '@filter' : $.byType.filter ? // Filter stays arrayed until the ast callback
                        [_async.map, _.flatMap($.byType.filter, 'expression'), expressionToJsonLd] : undefined,
                    '@optional' : $.byType.optional ? // OPTIONAL(a. b) is different from OPTIONAL(a) OPTIONAL(b)
                        [_util.miniMap, _.map($.byType.optional, 'patterns'), groupsToJsonLd] : undefined,
                    '@union' : $.byType.union ?
                        [_async.map, _.map(_.flatMap($.byType.union, 'patterns'), function (clause) {
                            // Each 'group' is an array of patterns
                            return clause.type === 'group' ? clause.patterns : [clause];
                        }), groupsToJsonLd] : undefined,
                    '@values': $.byType.values ?
                        [_async.map, _.flatMap($.byType.values, 'values'), valuesToJsonLd] : undefined
                }, pass(function (patterns) {
                    // In-line filters
                    if (patterns['@filter']) {
                        if (patterns['@graph'])
                            patterns['@graph'] = _util.inlineFilters(patterns['@graph'], patterns['@filter']);
                        patterns['@filter'] = _util.unArray(patterns['@filter']);
                        if (_.isEmpty(patterns['@filter']))
                            delete patterns['@filter'];
                    }
                    // If a singleton graph is the only thing we have, flatten it
                    if (_util.getOnlyKey(patterns) === '@graph')
                        patterns = patterns['@graph'];
                    cb(false, patterns);
                }, cb));
            }]
        }, pass(function ($) {
            return cb(false, _util.unArray(_.concat($.groups, $.queries, !_.isEmpty($.patterns) ? $.patterns : [])));
        }, cb));
    }

    function clausesToJsonLd(query, cb) {
        _util.ast({
            '@construct' : query.queryType === 'CONSTRUCT' ? [triplesToJsonLd, query.template] : undefined,
            '@select' : query.queryType === 'SELECT' && !query.distinct ?
                [_util.miniMap, query.variables, variableExpressionToJsonLd] : undefined,
            '@describe': query.queryType === 'DESCRIBE' ?
                [_util.miniMap, query.variables, variableExpressionToJsonLd] : undefined,
            '@distinct' : query.queryType === 'SELECT' && query.distinct ?
                [_util.miniMap, query.variables, variableExpressionToJsonLd] : undefined,
            '@where' : query.where ? [groupsToJsonLd, query.where] : undefined,
            '@orderBy' : [_util.miniMap, _.map(query.order, function (order) {
                return order.descending ? {
                    type : 'operation',
                    operator : 'descending',
                    args : [order.expression]
                } : order.expression;
            }), expressionToJsonLd],
            '@groupBy' : query.group ? [_util.miniMap, _.map(query.group, 'expression'), expressionToJsonLd] : undefined,
            '@having' : query.having ? [_util.miniMap, query.having, expressionToJsonLd] : undefined,
            '@limit' : query.limit,
            '@offset' : query.offset,
            '@values': query.values ? [_async.map, query.values, valuesToJsonLd] : undefined
        }, function (err, jsonRql) {
            return cb(err, jsonRql, query);
        });
    }

    return clausesToJsonLd(parsed, pass(function (jsonRql, query) {
        return cb(false, !_.isEmpty(prefixes) ? _.set(jsonRql, '@context', _util.toContext(prefixes)) : jsonRql, query);
    }, cb));
};
