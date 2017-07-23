var _ = require('lodash'),
    _jrql = require('../index'),
    hash = require('object-hash'),
    pass = require('pass-error'),
    expect = require('chai').expect,
    toComparableAst = require('./sparqljsUtil').toComparableAst,
    sparqlParser = new (require('sparqljs').Parser)(),
    forEachSparqlExample = require('./todo').forEachSparqlExample;

describe('SPARQL handling', function () {
    describe('conversion to SPARQL', function () {
        it('should accept variable subject', function (done) {
            _jrql.toSparql({
                '@select' : '?s',
                '@where' : {
                    '@id' : '?s',
                    'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' : { '@id' : 'http://example.org/cartoons#Cat' }
                }
            }, pass(function (sparql) {
                expect(sparql.replace(/\s+/g, ' ')).to.equal(
                    'SELECT ?s WHERE { ?s <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.org/cartoons#Cat>. }');
                done();
            }, done));
        });

        it('should accept variable object', function (done) {
            _jrql.toSparql({
                '@select' : '?s',
                '@where' : {
                    '@id' : 'http://example.org/cartoons#Tom',
                    'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' : { '@id' : '?t' }
                }
            }, pass(function (sparql) {
                expect(sparql.replace(/\s+/g, ' ')).to.equal(
                    'SELECT ?s WHERE { <http://example.org/cartoons#Tom> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ?t. }');
                done();
            }, done));
        });

        it('should accept variable predicate', function (done) {
            _jrql.toSparql({
                '@select' : '?s',
                '@where' : {
                    '@id' : 'http://example.org/cartoons#Tom',
                    '?p' : { '@id' : 'http://example.org/cartoons#Cat' }
                }
            }, pass(function (sparql) {
                expect(sparql.replace(/\s+/g, ' ')).to.equal(
                    'SELECT ?s WHERE { <http://example.org/cartoons#Tom> ?p <http://example.org/cartoons#Cat>. }');
                done();
            }, done));
        });

        it('should accept an anonymous subject', function (done) {
            _jrql.toSparql({
                '@select' : '?t',
                '@where' : {
                    'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' : { '@id' : '?t' }
                }
            }, pass(function (sparql) {
                expect(sparql.replace(/\s+/g, ' ').replace(/_:\w+/g, '[]')).to.equal(
                    'SELECT ?t WHERE { [] <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ?t. }');
                done();
            }, done));
        });

        it('should accept an anonymous object', function (done) {
            _jrql.toSparql({
                '@select' : '?s',
                '@where' : {
                    '@id' : 'http://example.org/cartoons#Tom',
                    'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' : { '@id' : '_:o' }
                }
            }, pass(function (sparql) {
                expect(sparql.replace(/\s+/g, ' ').replace(/_:\w+/g, '[]')).to.equal(
                    'SELECT ?s WHERE { <http://example.org/cartoons#Tom> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> []. }');
                done();
            }, done));
        });

        it('should accept an array select', function (done) {
            _jrql.toSparql({
                '@select' : ['?s'],
                '@where' : { '@id' : '?s', '?p' : { '@id' : '?o' } }
            }, pass(function (sparql) {
                expect(sparql.replace(/\s+/g, ' ')).to.equal('SELECT ?s WHERE { ?s ?p ?o. }');
                done();
            }, done));
        });

        it('should accept a JSON-LD @context', function (done) {
            _jrql.toSparql({
                '@context' : {
                    cartoon : 'http://example.org/cartoons#',
                    rdf : 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
                    'rdf:type' : { '@type' : '@id' }
                },
                '@select' : ['?s'],
                '@where' : { '@id' : '?s', 'rdf:type' : 'cartoon:Cat' }
            }, pass(function (sparql) {
                expect(sparql.replace(/\s+/g, ' ')).to.equal(
                    'SELECT ?s WHERE { ?s <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.org/cartoons#Cat>. }');
                done();
            }, done));
        });

        it('should merge a local JSON-LD @context', function (done) {
            _jrql.toSparql({
                '@context' : { rdf : 'http://www.w3.org/1999/02/22-rdf-syntax-ns#' },
                '@select' : '?s',
                '@where' : {
                    '@context' : { cartoon : 'http://example.org/cartoons#' },
                    '@id' : '?s',
                    'rdf:type' : { '@id' : 'cartoon:Cat' }
                }
            }, pass(function (sparql) {
                expect(sparql.replace(/\s+/g, ' ')).to.equal(
                    'SELECT ?s WHERE { ?s <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.org/cartoons#Cat>. }');
                done();
            }, done));
        });

        it('should accept a filtered select', function (done) {
            _jrql.toSparql({
                '@select' : '?s',
                '@where' : {
                    '@graph' : { '@id' : '?s', '?p' : '?o' },
                    '@filter' : { '@in' : ['?s', [{ '@id' : 'http://example.org/cartoons#Tom' }]] }
                }
            }, pass(function (sparql) {
                expect(sparql.replace(/\s+/g, ' ')).to.equal(
                    'SELECT ?s WHERE { ?s ?p ?o. FILTER(?s IN(<http://example.org/cartoons#Tom>)) }');
                done();
            }, done));
        });

        it('should accept an update with where and delete', function (done) {
            _jrql.toSparql({
                '@delete' : { '@id' : '?s', '?p' : '?o' },
                '@where' : { '@id' : '?s', '?p' : '?o' }
            }, pass(function (sparql) {
                expect(sparql.replace(/\s+/g, ' ')).to.equal('DELETE { ?s ?p ?o. } WHERE { ?s ?p ?o. }');
                done();
            }, done));
        });
    });

    describe('SPARQL.js examples', function () {
        forEachSparqlExample(function test(name, sparql, jrql) {
            var unmutated = _.cloneDeep(jrql);

            it('should convert SPARQL to json-rql for ' + name, function (done) {
                _jrql.toJsonRql(sparql, pass(function (jrql) {
                    expect(jrql).to.deep.equal(jrql);
                    done();
                }, done));
            });

            it('should convert json-rql to SPARQL for ' + name, function (done) {
                // Use sparqljs as a common currency for SPARQL
                var expectedAst = toComparableAst(sparqlParser.parse(sparql));
                _jrql.toSparql(jrql, pass(function (genSparql) {
                    var actualAst = toComparableAst(sparqlParser.parse(genSparql));
                    expect(actualAst).to.deep.equal(expectedAst);
                    // Check for mutation
                    expect(jrql).to.deep.equal(unmutated);
                    done();
                }, done));
            });
        });
    });
});
