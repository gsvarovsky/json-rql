var _ = require('lodash'),
    expect = require('chai').expect;

describe('JSON-RQL', function () {
    it('should work with the example from SPARQL.js', function (done) {
        var Module = require('module'), originalRequire = Module.prototype.require, originalLog = console.log;
        try {
            Module.prototype.require = function (module) {
                return module === 'json-rql/sparql' ? require('../sparql') : originalRequire.apply(this, arguments);
            };
            function restoreLog() { console.log = originalLog; }
            console.log = function (sparql) {
                try {
                    var parts = _(sparql.split(/[{}]|\.[\s*\n]/)).map(_.trim)
                        .map(str => str.replace(/[\s\n]+/g, ' ')).reject(_.isEmpty).value();
                    var selectWhere = parts[0];
                    var where = parts.slice(1);

                    expect(selectWhere).to.equal('SELECT ?p ?c WHERE');
                    expect(where).to.contain(
                        '?p <http://dbpedia.org/ontology/birthPlace> ?c; ' +
                        '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://dbpedia.org/ontology/Artist>');
                    expect(where).to.contain('?c <http://xmlns.com/foaf/0.1/name> "York"@en');
                } finally {
                    restoreLog();
                    done();
                }
            };
            require('../sparql/example');
        } catch (e) {
            restoreLog();
        } finally {
            Module.prototype.require = originalRequire;
        }
    });
});
