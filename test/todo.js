var _ = require('lodash'),
    _fs = require('fs'),
    _path = require('path'),
    _jrql = require('../index'),
    pass = require('pass-error'),
    stringify = require('json-stringify-pretty-compact'),
    sparqlFolder = _path.join(__dirname, '../node_modules/sparqljs/queries'),
    dataFolder = _path.join(__dirname, 'data');

// Outputs missing test cases to the erroring/noerrors folders
function enqueueTodo(sparql, testFilename) {
    _jrql.toJsonRql(sparql, function (err, jrql, parsed) {
        function outputTo(folder) {
            jrql.__sparql = sparql.split('\n');
            jrql.__parsed = parsed;
            writeJrql(_path.join(folder, testFilename), jrql);
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

function rmFrom(todoFolder, testFilename) {
    try {
        _fs.unlinkSync(_path.join(dataFolder, todoFolder, testFilename));
    } catch (e) {
    }
}

function writeJrql(fileName, jrql) {
    _fs.writeFileSync(_path.join(dataFolder, fileName), stringify(jrql), 'utf-8');
}

function readSparql(fileName) {
    var filePath = _path.join(sparqlFolder, fileName);
    if (_fs.existsSync(filePath)) {
        return _fs.readFileSync(filePath, 'utf-8');
    }
}

function readJrql(fileName) {
    var filePath = _path.join(dataFolder, fileName);
    if (_fs.existsSync(filePath)) {
        return JSON.parse(_fs.readFileSync(filePath, 'utf-8'));
    }
}
exports.forEachSparqlExample = function (test/*(name, sparql, jrql)*/) {
    _fs.readdirSync(sparqlFolder).forEach(function (name) {
        var sparql = readSparql(name),
            testCase = name.slice(0, name.lastIndexOf('.')),
            testFilename = testCase + '.json',
            jrql = readJrql(testFilename);

        rmFrom('erroring', testFilename);
        rmFrom('noerrors', testFilename);

        if (jrql) {
            test(testCase, sparql, jrql);
        } else {
            enqueueTodo(sparql, testFilename);
        }
    });
};

//noinspection JSUnusedGlobalSymbols
var commands = {
    show : function (testCase, cb) {
        var sparql = readSparql(testCase + '.sparql');
        if (sparql) {
            _jrql.toJsonRql(sparql, pass(function (jrql) {
                cb(false, sparql + '\n' + stringify(jrql));
            }, cb));
        } else {
            cb(testCase + ' not found.');
        }
    },
    approve : function (testCase, cb) {
        var testFileName = testCase + '.json', jrql = readJrql(_path.join('noerrors', testFileName));
        if (jrql) {
            writeJrql(testFileName, _.omitBy(jrql, function (v, k) { return k.startsWith('__'); }));
            rmFrom('noerrors', testFileName);
        } else {
            cb(testCase + ' is not in the noerrors folder');
        }
    }
};

if (process.argv[1] === __filename) {
    (commands[process.argv[2]] || function (unused, cb) {
        cb('Expected arguments: <command> <testCase>');
    })(process.argv[3], pass(console.log, console.error));
}
