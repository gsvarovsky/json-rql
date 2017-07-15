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
            return cb(false, _.set({}, operator, jsonldArgs));
        }, cb));
    }

    function expressionToJsonLd(expr, cb/*(err, jsonld)*/) {
        var operator, tempTriple;
        if (!_.isObject(expr)) {
            tempTriple = {subject: tempSubject, predicate: tempPredicate, object: _util.hideVar(expr)};
            return _util.toJsonLd([tempTriple], parsed.prefixes, pass(function (jsonld) {
                return cb(false, _util.unhideVars(jsonld[tempPredicate]));
            }, cb));
        } else if (expr.type === 'operation') {
            operator = _util.operators[expr.operator];
            return operator ? operationToJsonLd(operator, expr.args, cb) : cb('Unsupported operator: ' + expr.operator);
        } else if (expr.type === 'functionCall') {
            tempTriple = {subject: tempSubject, predicate: expr['function'], object: tempObject};
            _util.toJsonLd([tempTriple], parsed.prefixes, pass(function (jsonld) {
                return operationToJsonLd(_.findKey(jsonld, {'@id': tempObject}), expr.args, cb);
            }, cb));
        } else {
            return cb('Unsupported expression: ' + expr.type);
        }
    }

    function triplesToJsonLd(triples, cb) {
        return _util.toJsonLd(_.map(triples, function (triple) {
            return _.mapValues(triple, _util.hideVar);
        }), parsed.prefixes, pass(function (jsonld) {
            jsonld = _.omit(jsonld, '@context');
            // Optimise away redundant top-level objects
            jsonld = jsonld['@graph'] ? _util.nestGraph(jsonld['@graph']) : jsonld;
            // Unhide hidden subjects and predicates
            cb(false, _util.unhideVars(jsonld));
        }, cb));
    }

    function clausesToJsonLd(clauses, cb) {
        var byType = _.mapValues(_.groupBy(clauses, 'type'), function (homoClauses) {
            return !_.isEmpty(homoClauses) && function (key, bumpy) {
                    var clauses = _.map(homoClauses, key);
                    return bumpy ? clauses : _.flatten(clauses);
                }
        });
        return _util.ast({
            '@graph': byType.bgp ? [triplesToJsonLd, byType.bgp('triples')] : undefined,
            '@filter': byType.filter ?
                [_util.miniMap, byType.filter('expression'), expressionToJsonLd] : undefined,
            '@optional': byType.optional ? // OPTIONAL(a. b) is different from OPTIONAL(a) OPTIONAL(b)
                [_util.miniMap, byType.optional('patterns', true), clausesToJsonLd] : undefined,
            '@union': byType.union ? // Each 'group' is an array of patterns
                [_async.map, _.map(byType.union('patterns'), 'patterns'), clausesToJsonLd] : undefined
        }, pass(function (result) {
            // If a graph is the only thing we have, flatten it
            result = _.pickBy(result);
            return cb(false, _.isEqual(_.keys(result), ['@graph']) ? result['@graph'] : result);
        }, cb));
    }

    _util.ast({
        '@context': !_.isEmpty(parsed.prefixes) ? parsed.prefixes : undefined,
        '@construct': parsed.queryType === 'CONSTRUCT' ? [triplesToJsonLd, parsed.template] : undefined,
        '@select': parsed.queryType === 'SELECT' && !parsed.distinct ? _util.unArray(parsed.variables) : undefined,
        '@describe': parsed.queryType === 'DESCRIBE' ? _util.unArray(parsed.variables) : undefined,
        '@distinct': parsed.queryType === 'SELECT' && parsed.distinct ? _util.unArray(parsed.variables) : undefined,
        '@where': parsed.where ? [clausesToJsonLd, parsed.where] : undefined,
        '@orderBy': [_util.miniMap, _.map(parsed.order, function (order) {
            return order.descending ? {
                type: 'operation',
                operator: 'descending',
                args: [order.expression]
            } : order.expression;
        }), expressionToJsonLd],
        '@limit': parsed.limit,
        '@offset': parsed.offset
    }, function (err, jsonRql) {
        return cb(err, jsonRql, parsed);
    });
};
