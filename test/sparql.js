var _ = require('lodash'),
    _fs = require('fs'),
    _path = require('path'),
    _jrql = require('../sparql'),
    pass = require('pass-error'),
    expect = require('chai').expect,
    stringify = require('json-stringify-pretty-compact'),
    sparqlFolder = '../node_modules/sparqljs/queries';

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
        '@where' : { '@id' : 'http://example.org/cartoons#Tom', '?p' : { '@id' : 'http://example.org/cartoons#Cat' } }
      }, pass(function (sparql) {
        expect(sparql.replace(/\s+/g, ' ')).to.equal(
          'SELECT ?s WHERE { <http://example.org/cartoons#Tom> ?p <http://example.org/cartoons#Cat>. }');
        done();
      }, done));
    });

    it('should accept an array select', function (done) {
      _jrql.toSparql({
        '@select' : ['?s'],
        '@where' : [{ '@id' : '?s', '?p' : { '@id' : '?o' } }]
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
          '@filter' : { '@in' : ['?s', ['http://example.org/cartoons#Tom']] }
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
    _fs.readdirSync(_path.join(__dirname, sparqlFolder)).forEach(function (name) {
      var sparql = _fs.readFileSync(_path.join(__dirname, sparqlFolder, name), 'utf-8'),
          testcase = name.slice(0, name.lastIndexOf('.')),
          jrqlFile = _path.join(__dirname, 'sparql', testcase + '.json');

      if (_fs.existsSync(jrqlFile)) {
        var expected = JSON.parse(_fs.readFileSync(jrqlFile, 'utf-8'));
        it('should convert ' + testcase, function (done) {
          _jrql.toJsonRql(sparql, pass(function (jrql) {
            expect(jrql).to.deep.equal(expected);
            done();
          }, done));
        });
      } else {
        // Output the missing test case to the todo folder
        _jrql.toJsonRql(sparql, function (err, jrql, parsed) {
          err && (jrql.__err = err);
          jrql.__sparql = sparql.split('\n');
          jrql.__parsed = parsed;
          _fs.writeFileSync(_path.join(__dirname, 'sparql', 'todo', testcase + '.json'), stringify(jrql), 'utf-8');
        });
      }
    });
  });
});
