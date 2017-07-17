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

    function toTriples(jsonld, cb/*(err, [triple])*/) {
        var localContext = _.merge(jsonld['@context'], context);
        // Clone the json-ld to maintain our non-mutation contract
        _util.toTriples(_util.hideVars(_.set(_.cloneDeep(jsonld), '@context', localContext)), pass(function (triples) {
            cb(false, _.map(triples, function (triple) {
                return _.mapValues(triple, _util.unhideVar);
            }));
        }, cb));
    }

    function toBgp(jsonld, cb/*(err, { type : 'bgp', triples : [] })*/) {
        return _util.ast({ type : 'bgp', triples : [toTriples, jsonld] }, cb);
    }

    function expressionToSparqlJs(expr, cb/*(err, ast)*/) {
        var operator = _.isPlainObject(expr) && _.size(expr) === 1 && _.first(_.keys(expr));
        if (operator) {
            var argTemplate = [_async.map, _.castArray(expr[operator]), expressionToSparqlJs];
            if (_.includes(_.values(_util.operators), operator)) {
                // An operator expression
                return _util.ast({
                    type : 'operation',
                    operator : _.invert(_util.operators)[operator],
                    args : argTemplate
                }, cb);
            } else if (!operator.startsWith('@')) {
                // A function expression
                return toTriples(_util.kvo(operator, tempObject), pass(function (triples) {
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
        return toTriples(_util.kvo(tempPredicate, expr), pass(function (triples) {
            return cb(false, _.isArray(expr) ? _.map(triples, 'object') : triples[0].object);
        }, cb));
    }

    function clauseToSparqlJs(clause, cb/*(err, ast)*/) {
        if (clause['@id']) {
            // Straight JSON-LD object. Return array with one bgp.
            return toBgp(clause, pass(function (result) {
                cb(false, [result]);
            }, cb));
        } else {
            return _async.concat(_.keys(clause), function (key, cb) {
                switch (key) {
                    case '@graph':
                        return toBgp(_.pick(clause, '@graph'), cb);
                    case '@filter':
                        return _async.map(_.castArray(clause[key]), function (expr, cb) {
                            return _util.ast({ type : 'filter', expression : [expressionToSparqlJs, expr] }, cb);
                        }, cb);
                    case '@optional':
                        return _async.map(_.castArray(clause[key]), function (clause, cb) {
                            return _util.ast({ type : 'optional', patterns : [clauseToSparqlJs, clause] }, cb);
                        }, cb);
                    case '@union':
                        return _util.ast({
                            type : 'union',
                            patterns : [_async.map, clause[key], function (group, cb) {
                                return _util.ast({ type : 'group', patterns : [clauseToSparqlJs, group] }, cb);
                            }]
                        }, cb);
                    default:
                        return cb('Unsupported clause key: ' + key + ' in ' + JSON.stringify(clause));
                }
            }, cb);
        }
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
        template : jrql['@construct'] ? [toTriples, jrql['@construct']] : undefined,
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
        return cb(false, sparqlGenerator.stringify(sparqljs), sparqljs);
    }, cb)) : cb('Unsupported type');
};
