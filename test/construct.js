var _ = require('lodash'),
    expect = require('chai').expect,
    _jrql = require('../sparql'),
    pass = require('pass-error');

describe('JSON-RQL', function () {
  it('should work with a deep construct', function (done) {
    var template = {
      '@id' : '?lib',
      '@type' : 'ex:Library',
      'ex:contains' : {
        '@id' : '?book',
        '@type' : 'ex:Book',
        'dc:creator' : '?creator',
        '?bp' : '?bo',
        'ex:contains' : {
          '@id' : '?chapter',
          '@type' : 'ex:Chapter',
          '?cp' : '?co'
        }
      }
    };
    _jrql.toSparql({
      '@context' : {
        dc : 'http://purl.org/dc/elements/1.1/',
        rdf : 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        xsd : 'http://www.w3.org/2001/XMLSchema#',
        ex : 'http://example.com/'
      },
      '@construct' : template,
      '@where' : template
    }, pass(function (sparql) {
        var parts = _(sparql.split(/[{}]|\.[\s*\n]/)).map(_.trim).map(str => str.replace(/[\s\n]+/g, ' ')).reject(_.isEmpty).value();
        var constructKeyword = parts[0];
        var construct = parts.slice(1, 9);
        var whereKeyword = parts[9];
        var where = parts.slice(10);
        
        expect(constructKeyword).to.equal('CONSTRUCT');
        expect(construct).to.contain('?book <http://example.com/contains> ?chapter');
        expect(construct).to.contain('?book ?bp ?bo');
        expect(construct).to.contain('?book <http://purl.org/dc/elements/1.1/creator> ?creator');
        expect(construct).to.contain('?book <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.com/Book>');
        expect(construct).to.contain('?chapter ?cp ?co');
        expect(construct).to.contain('?chapter <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.com/Chapter>');
        expect(construct).to.contain('?lib <http://example.com/contains> ?book');
        expect(construct).to.contain('?lib <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.com/Library>');
        expect(whereKeyword).to.equal('WHERE');
        expect(where).to.contain(
          '?book <http://example.com/contains> ?chapter; ' +
          '?bp ?bo; ' +
          '<http://purl.org/dc/elements/1.1/creator> ?creator; ' +
          '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.com/Book>');
        expect(where).to.contain(
          '?chapter ?cp ?co; ' +
          '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.com/Chapter>');
        expect(where).to.contain(
          '?lib <http://example.com/contains> ?book; ' +
          '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.com/Library>');
        done();
    }, done));
  });
});
