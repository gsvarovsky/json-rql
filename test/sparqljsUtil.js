var _ = require('lodash'),
    hash = require('object-hash'),
    pass = require('pass-error'),
    expect = require('chai').expect;

function toComparableAst(ast) {
    return _.isObject(ast) ? _(ast).omit('prefixes').transform(function (ast, v, k) {
        return _.set(ast, k, ({
            triples : toComparableSet,
            template : toComparableSet,
            where : toComparableClause
        }[k] || toComparableAst)(v));
    }).value() : ast;
}

function toComparableSet(array) {
    return _.transform(array, function (ast, v) {
        v = toComparableAst(v);
        return _.set(ast, hash(v), v);
    }, {});
}

function toComparableClause(array) {
    // For now, collapse all bgp arrays into one. TODO: Note Issue #4
    var parts = _.partition(array, { type : 'bgp' }), bgps = parts[0], others = parts[1];
    return toComparableSet(bgps.length > 0 ? _.concat(_.reduce(bgps, function (oneRing, bgp) {
        return _.set(oneRing, 'triples', _.concat(oneRing.triples, bgp.triples));
    }, { type : 'bgp', triples : [] }), others) : others);
}

// Test ourselves for sanity
describe('SPARQL.js comparable AST', function () {
    it('leaves literals alone', function () {
        expect(toComparableAst(1)).to.equal(1);
        expect(toComparableAst('a')).to.equal('a');
    });

    it('makes objects into plain objects', function () {
        expect(toComparableAst([])).to.deep.equal({});
        expect(toComparableAst({})).to.deep.equal({});
    });

    it('leaves filters alone', function () {
        expect(toComparableAst({
            type : 'filter',
            expression: {}
        })).to.deep.equal({
            type : 'filter',
            expression: {}
        });
    });

    it('makes triple arrays into a set', function () {
        var triple = { subject : '?s', predicate : '?p', object : '?o' };
        expect(toComparableAst({
            type : 'bgp',
            triples: [triple]
        })).to.deep.equal({
            type : 'bgp',
            triples: _.set({}, hash(triple), triple)
        });
    });

    it('makes where clauses into a set', function () {
        var where = { type : 'filter', expression: {} };
        expect(toComparableAst({
            where : [where]
        })).to.deep.equal({
            where: _.set({}, hash(where), where)
        });
    });

    it('collapses where bgp clauses', function () {
        var triple1 = { subject : '?s1', predicate : '?p1', object : '?o1' };
        var triple2 = { subject : '?s2', predicate : '?p2', object : '?o2' };
        var finalBgp = { type : 'bgp', triples : _({}).set(hash(triple1), triple1).set(hash(triple2), triple2).value() };

        expect(toComparableAst({
            where : [{ type : 'bgp', triples: [triple1] }, { type : 'bgp', triples: [triple2] }]
        })).to.deep.equal({
            where: _.set({}, hash(finalBgp), finalBgp)
        });
    });
});

exports.toComparableAst = toComparableAst;