[![Build Status](https://travis-ci.org/gsvarovsky/json-rql.svg?branch=master)](https://travis-ci.org/gsvarovsky/json-rql)
[![GitHub stars](https://img.shields.io/github/stars/gsvarovsky/json-rql.svg)](https://github.com/gsvarovsky/json-rql/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/gsvarovsky/json-rql.svg)](https://github.com/gsvarovsky/json-rql/issues)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/gsvarovsky/json-rql/master/LICENSE)
[![Try json-rql on RunKit](https://badge.runkitcdn.com/json-rql.svg)](https://npm.runkit.com/json-rql)
# json-rql
_JSON Resource Query Language, for simple, consistent query APIs_

This repository and library primarily presents a _convention_ for expressing queries against structured resources, using JSON. It is intended to help application developers resolve the tensions between _expressibility_ and _simplicity_, and between _agility_ and _future-proofing_, in API design. It is based on [JSON-LD](https://json-ld.org).

A simple example query:
```json
{ "@where" : { "@type" : "Person", "name" : { "@contains" : "Fred" } } }
```

1. It's JSON: straightforward to construct in code, manipulate and serialize, and also to _constrain_. Use standard JSON tooling to limit your API to the queries that your back-end has been designed and tested for.
2. It's SPARQL: _in context_, all queries can be translated to the W3C standard language for directed, labeled graph data. This means that your API can be extended to cover future query requirements, without breaking changes.

Please see [the wiki](https://github.com/gsvarovsky/json-rql/wiki) for a narrative explanation of these design choices, and for a walkthrough of common query types.

**[Feedback](https://github.com/gsvarovsky/json-rql/issues) and contributions welcome!**

## SPARQL Translation
This library serves to demonstrate and test interconvertibility of **json-rql** and SPARQL. It can be used directly in a Javascript environment to translate queries, for example in an API implementation where the back-end supports SPARQL.

```javascript
require('json-rql').toSparql({
  '@select' : '?s',
  '@where' : { '@id' : '?s', '?p' : '?o' }
}, function (err, sparql) {
  // sparql => SELECT ?s WHERE { ?s ?p ?o. }
});
```

For translation into SPARQL, a **json-rql** query typically requires a `@select`, `@construct` or `@describe` clause, and a `@context` to provide the mapping between terms and IRIs. (When used in an API, these elements will often derive from the call context.)

SPARQL language keywords supported so far are:

`SELECT`, `CONSTRUCT`, `DESCRIBE`, `WHERE`, `FILTER`, `OPTIONAL`, `UNION`, `ORDER BY`, `LIMIT`, `OFFSET`

Using the [example](https://www.npmjs.com/package/sparqljs#representation) from SPARQL.js:
```javascript
require('json-rql').toSparql({
  '@context' : {
    'dbpedia-owl' : 'http://dbpedia.org/ontology/'
  },
  '@select' : ['?p', '?c'],
  '@where' : {
    '@id' : '?p',
    '@type' : 'dbpedia-owl:Artist',
    'dbpedia-owl:birthPlace' : {
      '@id' : '?c',
      'http://xmlns.com/foaf/0.1/name' : {
        '@value' : 'York',
        '@language' : 'en'
      }
    }
  }
} ,function (err, sparql) {
  // sparql => SELECT ?p ?c WHERE {
  //   ?c <http://xmlns.com/foaf/0.1/name> "York"@en.
  //   ?p <http://dbpedia.org/ontology/birthPlace> ?c.
  //   ?p <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://dbpedia.org/ontology/Artist>.
  // }
});
```

See the tests (especially the JSON files in test/data) for more examples.

### Rules and Gotchas
* Use `@distinct` for `SELECT DISTINCT`
* `@where` is an object which is either just one JSON-LD (nested) object, or a `@graph`, plus any
other required clauses like `@filter`, `@optional` etc.

### Operators
Operator expressions are an object with one key (the operator), whose value is the operator arguments; e.g. `{ '@regex' : ['?label', 'word'] }`.

The exception to this is the use of in-line filters, which are like infix operators. In this case, the filter is embedded in the graph, and the first parameter to the operator is an implicit variable (see the top example above). The variable can be made explicit by the use of an `@id` tag as follows:
```json
"@where": { "@id": "?s", "p": { "@id" : "?o", "@contains": "fred" } }
```

The supported operators can be found in [operators.json](lib/operators.json).

## References
* [JSON-LD Home](http://json-ld.org/)
* [JSON-LD Specification](http://json-ld.org/spec/latest/json-ld/)
* [SPARQL](https://www.w3.org/TR/rdf-sparql-query)
* [SPARQL.js](https://github.com/RubenVerborgh/SPARQL.js)
* [JSON Schema](http://json-schema.org/)
* [Joi](https://github.com/hapijs/joi)
* [Jackson](https://github.com/FasterXML/jackson)
* [Resource Query Language (URL query-based)](https://github.com/persvr/rql)
