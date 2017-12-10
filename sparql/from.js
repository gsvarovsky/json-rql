var _ = require('lodash'),
    _util = require('../lib/util'),
    _async = require('async'),
    pass = require('pass-error'),
    sparqlParser = new (require('sparqljs').Parser)(),
    tempSubject = 'http://json-rql.org/subject',
    tempPredicate = 'http://json-rql.org/predicate',
    tempObject = 'http://json-rql.org/object';

module.exports = function toJsonRql(sparql, cb/*(err, jsonRql, parsed)*/) {
    var parsed = sparqlParser.parse(sparql);

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
        if (_.isArray(expr) || !_.isObject(expr)) {
            tempTriples = _.map(_.castArray(expr), function (e) {
                return { subject : tempSubject, predicate : tempPredicate, object : _util.hideVar(e) }
            });
            return _util.toJsonLd(tempTriples, parsed.prefixes, pass(function (jsonld) {
                return cb(false, _util.unhideVars(jsonld[tempPredicate]));
            }, cb));
        } else if (expr.type === 'operation') {
            operator = _.findKey(_util.operators, { sparql : expr.operator });
            return operator ? operationToJsonLd(operator, expr.args, cb) : cb('Unsupported operator: ' + expr.operator);
        } else if (expr.type === 'functionCall') {
            tempTriples = [{ subject : tempSubject, predicate : expr['function'], object : tempObject }];
            _util.toJsonLd(tempTriples, parsed.prefixes, pass(function (jsonld) {
                return operationToJsonLd(_.findKey(jsonld, { '@id' : tempObject }), expr.args, cb);
            }, cb));
        } else if (expr.type === 'aggregate') {
            operator = _.findKey(_util.operators, { sparql : expr.aggregation });
            return operator ? operationToJsonLd(operator, [expr.expression], cb) : cb('Unsupported aggregate: ' + expr.aggregation);
        } else {
            return cb('Unsupported expression: ' + expr.type || expr);
        }
    }

    function triplesToJsonLd(triples, cb) {
        return _util.toJsonLd(_.map(triples, function (triple) {
            return _.mapValues(triple, _util.hideVar);
        }), parsed.prefixes, pass(function (jsonld) {
            jsonld = _.omit(jsonld, '@context');
            // Optimise away redundant top-level objects
            jsonld = jsonld['@graph'] ? _util.inlineGraph(jsonld['@graph']) : jsonld;
            // Unhide hidden subjects and predicates
            cb(false, _util.unhideVars(jsonld));
        }, cb));
    }

    function variableExpressionToJsonLd(varExpr, cb) {
        if (_.isObject(varExpr)) {
            return expressionToJsonLd(varExpr.expression, pass(function (expr) {
                return cb(false, _util.kvo(varExpr.variable, expr));
            }, cb));
        } else {
            return cb(false, varExpr);
        }
    }

    function valuesToJsonLd(values) {
        // SPARQL.js leaves undefined values for UNDEF variable values
        return _.map(values, function (value) { return _.omitBy(value, _.isUndefined); });
    }

    function clausesToJsonLd(clauses, cb) {
        var byType = _.groupBy(clauses, 'type');
        return _async.map(_.map(byType.group, 'patterns'), clausesToJsonLd, pass(function (groups) {
            return _util.ast({
                '@graph' : byType.bgp ? [triplesToJsonLd, _.flatMap(byType.bgp, 'triples')] : undefined,
                '@bind' : byType.bind ? [_async.mapValues, _.transform(byType.bind, function (bind, clause) {
                    bind[clause.variable] = clause.expression;
                }, {}), function (v, k, cb) { return expressionToJsonLd(v, cb); }] : undefined,
                '@filter' : byType.filter ?
                    [_async.map, _.flatMap(byType.filter, 'expression'), expressionToJsonLd] : undefined,
                '@optional' : byType.optional ? // OPTIONAL(a. b) is different from OPTIONAL(a) OPTIONAL(b)
                    [_util.miniMap, _.map(byType.optional, 'patterns'), clausesToJsonLd] : undefined,
                '@union' : byType.union ?
                    [_async.map, _.map(_.flatMap(byType.union, 'patterns'), function (clause) {
                        // Each 'group' is an array of patterns
                        return clause.type === 'group' ? clause.patterns : [clause];
                    }), clausesToJsonLd] : undefined,
                '@values' : byType.values ? valuesToJsonLd(_.flatMap(byType.values, 'values')) : undefined
            }, pass(function (result) {
                // In-line filters
                if (result['@graph'] && result['@filter']) {
                    result['@graph'] = _util.inlineFilters(result['@graph'], result['@filter']);
                    _.isEmpty(result['@filter'] = _util.unArray(result['@filter'])) && delete result['@filter'];
                }
                // If a singleton graph is the only thing we have, flatten it
                if (_util.getOnlyKey(result) === '@graph')
                    result = result['@graph'];
                return cb(false, _util.unArray(_.isEmpty(result) ? groups : groups.concat(result)));
            }, cb));
        }, cb));
    }

    _util.ast({
        '@context' : !_.isEmpty(parsed.prefixes) ? _util.toContext(parsed.prefixes) : undefined,
        '@construct' : parsed.queryType === 'CONSTRUCT' ? [triplesToJsonLd, parsed.template] : undefined,
        '@select' : parsed.queryType === 'SELECT' && !parsed.distinct ?
            [_util.miniMap, parsed.variables, variableExpressionToJsonLd] : undefined,
        '@describe' : parsed.queryType === 'DESCRIBE' ? _util.unArray(parsed.variables) : undefined,
        '@distinct' : parsed.queryType === 'SELECT' && parsed.distinct ?
            [_util.miniMap, parsed.variables, variableExpressionToJsonLd] : undefined,
        '@where' : parsed.where ? [clausesToJsonLd, parsed.where] : undefined,
        '@orderBy' : [_util.miniMap, _.map(parsed.order, function (order) {
            return order.descending ? {
                type : 'operation',
                operator : 'descending',
                args : [order.expression]
            } : order.expression;
        }), expressionToJsonLd],
        '@groupBy' : parsed.group ? [_util.miniMap, _.map(parsed.group, 'expression'), expressionToJsonLd] : undefined,
        '@having' : parsed.having ? [_util.miniMap, parsed.having, expressionToJsonLd] : undefined,
        '@limit' : parsed.limit,
        '@offset' : parsed.offset,
        '@values' : parsed.values ? valuesToJsonLd(parsed.values) : undefined
    }, function (err, jsonRql) {
        return cb(err, jsonRql, parsed);
    });
};
