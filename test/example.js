var _ = require('lodash'),
    expect = require('chai').expect;

describe('JSON-RQL', function () {
    it('should work with the example from SPARQL.js', function (done) {
        var Module = require('module'), originalRequire = Module.prototype.require, originalLog = console.log;
        try {
            Module.prototype.require = function (module) {
                return module === 'json-rql' ? require('../index') : originalRequire.apply(this, arguments);
            };
            function restoreLog() { console.log = originalLog; }
            console.log = function (sparql) {
                try {
                    var parts = _(sparql.split(/[{}]|\.[\s*\n]/)).map(_.trim).reject(_.isEmpty).value();
                    var selectWhere = parts[0];
                    var where = parts.slice(1);

                    expect(selectWhere).to.equal('SELECT ?p ?c WHERE');
                    expect(where).to.contain('?p <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://dbpedia.org/ontology/Artist>');
                    expect(where).to.contain('?p <http://dbpedia.org/ontology/birthPlace> ?c');
                    expect(where).to.contain('?c <http://xmlns.com/foaf/0.1/name> "York"@en');
                } finally {
                    restoreLog();
                    done();
                }
            };
            require('../example');
        } catch (e) {
            restoreLog();
        } finally {
            Module.prototype.require = originalRequire;
        }
    });
});
