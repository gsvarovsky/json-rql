var _ = require('lodash'),
    _chai = require('chai'),
    _jsonRql = require('../index'),
    pass = require('pass-error');

describe('JSON-RQL', function () {
    it('should work with a deep construct', function (done) {
        _jsonRql.toSparql({
            '@context' : {
                dc : 'http://purl.org/dc/elements/1.1/',
                rdf : 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
                xsd : 'http://www.w3.org/2001/XMLSchema#',
                ex : 'http://example.com/'
            },
            queryType : 'CONSTRUCT',
            template : {
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
            },
            where : {
                '@id': '?lib',
                '@type': 'ex:Library',
                'ex:contains': {
                    '@id': '?book',
                    '@type': 'ex:Book',
                    'dc:creator': '?creator',
                    '?bp': '?bo',
                    'ex:contains': {
                        '@id': '?chapter',
                        '@type': 'ex:Chapter',
                        '?cp': '?co'
                    }
                }
            }

        }, pass(function (sparql) {
            var parts = _(sparql.split(/[{}]|\.[\s*\n]/)).map(_.trim).reject(_.isEmpty).value();
            _chai.expect(parts[0]).to.equal('CONSTRUCT');
            _chai.expect(parts.slice(1, 9)).to.contain('?book <http://example.com/contains> ?chapter');
            _chai.expect(parts.slice(1, 9)).to.contain('?book ?bp ?bo');
            _chai.expect(parts.slice(1, 9)).to.contain('?book <http://purl.org/dc/elements/1.1/creator> ?creator');
            _chai.expect(parts.slice(1, 9)).to.contain('?book <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.com/Book>');
            _chai.expect(parts.slice(1, 9)).to.contain('?chapter ?cp ?co');
            _chai.expect(parts.slice(1, 9)).to.contain('?chapter <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.com/Chapter>');
            _chai.expect(parts.slice(1, 9)).to.contain('?lib <http://example.com/contains> ?book');
            _chai.expect(parts.slice(1, 9)).to.contain('?lib <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.com/Library>');
            _chai.expect(parts[9]).to.equal('WHERE');
            _chai.expect(parts.slice(10)).to.contain('?book <http://example.com/contains> ?chapter');
            _chai.expect(parts.slice(10)).to.contain('?book ?bp ?bo');
            _chai.expect(parts.slice(10)).to.contain('?book <http://purl.org/dc/elements/1.1/creator> ?creator');
            _chai.expect(parts.slice(10)).to.contain('?book <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.com/Book>');
            _chai.expect(parts.slice(10)).to.contain('?chapter ?cp ?co');
            _chai.expect(parts.slice(10)).to.contain('?chapter <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.com/Chapter>');
            _chai.expect(parts.slice(10)).to.contain('?lib <http://example.com/contains> ?book');
            _chai.expect(parts.slice(10)).to.contain('?lib <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.com/Library>');
            done();
        }, done));
    });
});


