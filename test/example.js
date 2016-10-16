var _ = require('lodash'),
    _chai = require('chai'),
    _jsonRql = require('../sparql'),
    pass = require('pass-error');

describe('JSON-RQL', function () {
    it('should work with the example from SPARQL.js', function (done) {
        _jsonRql.toSparql({
            '@context' : {
                rdf : 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
                'dbpedia-owl' : 'http://dbpedia.org/ontology/'
            },
            variables : ['?p', '?c'],
            where : {
                '@id' : '?p',
                'rdf:type' : { '@id' : 'dbpedia-owl:Artist' },
                'dbpedia-owl:birthPlace' : {
                    '@id' : '?c',
                    'http://xmlns.com/foaf/0.1/name' : {
                        '@value' : 'York',
                        '@language' : 'en'
                    }
                }
            }
        }, pass(function (sparql) {
            var parts = _(sparql.split(/[{}]|\.[\s*\n]/)).map(_.trim).reject(_.isEmpty).value();
            _chai.expect(parts[0]).to.equal('SELECT ?p ?c WHERE');
            _chai.expect(parts.slice(1)).to.contain('?p <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://dbpedia.org/ontology/Artist>');
            _chai.expect(parts.slice(1)).to.contain('?p <http://dbpedia.org/ontology/birthPlace> ?c');
            _chai.expect(parts.slice(1)).to.contain('?c <http://xmlns.com/foaf/0.1/name> "York"@en');
            done();
        }, done));
    });
});
