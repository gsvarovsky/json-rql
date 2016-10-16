var _ = require('lodash'),
    _chai = require('chai'),
    _jsonRql = require('../sparql'),
    pass = require('pass-error');

describe('JSON-RQL', function () {
    it('should accept variable subject', function (done) {
        _jsonRql.toSparql({
            type : 'query',
            queryType : 'SELECT',
            variables : ['?s'],
            where : {
                '@id' : '?s',
                'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' : { '@id' : 'http://example.org/cartoons#Cat' }
            }
        }, pass(function (sparql) {
            _chai.expect(sparql.replace(/\s+/g, ' ')).to.equal(
                'SELECT ?s WHERE { ?s <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.org/cartoons#Cat>. }');
            done();
        }, done));
    });

    it('should accept variable object', function (done) {
        _jsonRql.toSparql({
            type : 'query',
            queryType : 'SELECT',
            variables : ['?s'],
            where : {
                '@id' : 'http://example.org/cartoons#Tom',
                'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' : { '@id' : '?t' }
            }
        }, pass(function (sparql) {
            _chai.expect(sparql.replace(/\s+/g, ' ')).to.equal(
                'SELECT ?s WHERE { <http://example.org/cartoons#Tom> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ?t. }');
            done();
        }, done));
    });

    it('should accept variable predicate', function (done) {
        _jsonRql.toSparql({
            type : 'query',
            queryType : 'SELECT',
            variables : ['?s'],
            where : { '@id' : 'http://example.org/cartoons#Tom', '?p' : { '@id' : 'http://example.org/cartoons#Cat' } }
        }, pass(function (sparql) {
            _chai.expect(sparql.replace(/\s+/g, ' ')).to.equal(
                'SELECT ?s WHERE { <http://example.org/cartoons#Tom> ?p <http://example.org/cartoons#Cat>. }');
            done();
        }, done));
    });

    it('should accept an array select', function (done) {
        _jsonRql.toSparql({
            type : 'query',
            queryType : 'SELECT',
            variables : ['?s'],
            where : [{ '@id' : '?s', '?p' : { '@id' : '?o' } }]
        }, pass(function (sparql) {
            _chai.expect(sparql.replace(/\s+/g, ' ')).to.equal('SELECT ?s WHERE { ?s ?p ?o. }');
            done();
        }, done));
    });

    it('should default the type to query and SELECT', function (done) {
        _jsonRql.toSparql({
            variables : ['?s'],
            where : { '@id' : '?s', '?p' : '?o' }
        }, pass(function (sparql) {
            _chai.expect(sparql.replace(/\s+/g, ' ')).to.equal('SELECT ?s WHERE { ?s ?p ?o. }');
            done();
        }, done));
    });

    it('should accept a JSON-LD @context', function (done) {
        _jsonRql.toSparql({
            '@context' : {
                cartoon : 'http://example.org/cartoons#',
                rdf : 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
                'rdf:type' : { '@type' : '@id' }
                },
            variables : ['?s'],
            where : { '@id' : '?s', 'rdf:type' : 'cartoon:Cat' }
        }, pass(function (sparql) {
            _chai.expect(sparql.replace(/\s+/g, ' ')).to.equal(
                'SELECT ?s WHERE { ?s <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.org/cartoons#Cat>. }');
            done();
        }, done));
    });

    it('should merge a local JSON-LD @context', function (done) {
        _jsonRql.toSparql({
            '@context' : { rdf : 'http://www.w3.org/1999/02/22-rdf-syntax-ns#' },
            variables : ['?s'],
            where : {
                '@context' : { cartoon : 'http://example.org/cartoons#' },
                '@id' : '?s',
                'rdf:type' : { '@id' : 'cartoon:Cat' }
            }
        }, pass(function (sparql) {
            _chai.expect(sparql.replace(/\s+/g, ' ')).to.equal(
                'SELECT ?s WHERE { ?s <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.org/cartoons#Cat>. }');
            done();
        }, done));
    });

    it('should accept a filtered select', function (done) {
        _jsonRql.toSparql({
            variables : ['?s'],
            where : [{ '@id' : '?s', '?p' : '?o' }, {
                type : 'filter',
                expression : {
                    type : 'operation',
                    operator : 'in',
                    args : ['?s', ['http://example.org/cartoons#Tom']]
                }
            }]
        }, pass(function (sparql) {
            _chai.expect(sparql.replace(/\s+/g, ' ')).to.equal(
                'SELECT ?s WHERE { ?s ?p ?o. FILTER(?s IN(<http://example.org/cartoons#Tom>)) }');
            done();
        }, done));
    });

    it('should accept an update with where and delete', function (done) {
        _jsonRql.toSparql({
            type : 'update',
            updates : {
                delete : { '@id' : '?s', '?p' : '?o' },
                where : { '@id' : '?s', '?p' : '?o' }
            }
        }, pass(function (sparql) {
            _chai.expect(sparql.replace(/\s+/g, ' ')).to.equal('DELETE { ?s ?p ?o. } WHERE { ?s ?p ?o. }');
            done();
        }, done));
    });
});
