var _fs = require('fs'),
    _path = require('path'),
    _jrql = require('../index'),
    hash = require('object-hash'),
    pass = require('pass-error'),
    expect = require('chai').expect,
    toComparableAst = require('./sparqljsUtil').toComparableAst,
    stringify = require('json-stringify-pretty-compact'),
    sparqlParser = new (require('sparqljs').Parser)(),
    sparqlFolder = _path.join(__dirname, '../node_modules/sparqljs/queries'),
    dataFolder = _path.join(__dirname, 'data');

describe('SPARQL handling', function () {
    describe('conversion to SPARQL', function () {
        it('should accept variable subject', function (done) {
            _jrql.toSparql({
                '@select' : ['?s'],
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
                '@select' : ['?s'],
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
                '@select' : ['?s'],
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
                '@select' : ['?s'],
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
                '@select' : ['?s'],
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
        _fs.readdirSync(sparqlFolder).forEach(function (name) {
            var sparql = _fs.readFileSync(_path.join(sparqlFolder, name), 'utf-8'),
                testCase = name.slice(0, name.lastIndexOf('.')),
                testFilename = testCase + '.json',
                testFile = _path.join(dataFolder, testFilename);

            function rmFrom(folder) {
                try {
                    _fs.unlinkSync(_path.join(dataFolder, folder, testFilename));
                } catch (e) {
                }
            }

            rmFrom('erroring');
            rmFrom('noerrors');

            if (_fs.existsSync(testFile)) {
                var expected = JSON.parse(_fs.readFileSync(testFile, 'utf-8'));

                it('should convert SPARQL to json-rql for ' + testCase, function (done) {
                    _jrql.toJsonRql(sparql, pass(function (jrql) {
                        expect(jrql).to.deep.equal(expected);
                        done();
                    }, done));
                });

                it('should convert json-rql to SPARQL for ' + testCase, function (done) {
                    // Use sparqljs as a common currency for SPARQL
                    var expectedAst = toComparableAst(sparqlParser.parse(sparql));
                    _jrql.toSparql(expected, pass(function (genSparql) {
                        var actualAst = toComparableAst(sparqlParser.parse(genSparql));
                        expect(actualAst).to.deep.equal(expectedAst);
                        done();
                    }, done));
                });
            } else {
                // Output the missing test cases to the errors folder
                _jrql.toJsonRql(sparql, function (err, jrql, parsed) {
                    function outputTo(folder) {
                        jrql.__sparql = sparql.split('\n');
                        jrql.__parsed = parsed;
                        _fs.writeFileSync(_path.join(dataFolder, folder, testFilename), stringify(jrql), 'utf-8');
                    }
                    if (err) {
                        jrql.__fromErr = err;
                        outputTo('erroring');
                    } else {
                        _jrql.toSparql(jrql, function (err, revSparql) {
                            if (err) {
                                jrql.__toErr = err;
                                outputTo('erroring');
                            } else {
                                jrql.__revSparql = revSparql.split('\n');
                                outputTo('noerrors');
                            }
                        });
                    }
                });
            }
        });
    });
});
