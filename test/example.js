var _ = require('lodash'),
    expect = require('chai').expect,
    _jrql = require('../index'),
    pass = require('pass-error');

describe('JSON-RQL', function () {
    it('should work with the example from SPARQL.js', function (done) {
        _jrql.toSparql({
            '@context': {
                'dbpedia-owl': 'http://dbpedia.org/ontology/'
            },
            '@select': ['?p', '?c'],
            '@where': {
                '@id': '?p',
                '@type': 'dbpedia-owl:Artist',
                'dbpedia-owl:birthPlace': {
                    '@id': '?c',
                    'http://xmlns.com/foaf/0.1/name': {
                        '@value': 'York',
                        '@language': 'en'
                    }
                }
            }
        }, pass(function (sparql) {
            var parts = _(sparql.split(/[{}]|\.[\s*\n]/)).map(_.trim).reject(_.isEmpty).value();
            var selectWhere = parts[0];
            var where = parts.slice(1);

            expect(selectWhere).to.equal('SELECT ?p ?c WHERE');
            expect(where).to.contain('?p <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://dbpedia.org/ontology/Artist>');
            expect(where).to.contain('?p <http://dbpedia.org/ontology/birthPlace> ?c');
            expect(where).to.contain('?c <http://xmlns.com/foaf/0.1/name> "York"@en');
            done();
        }, done));
    });
});
