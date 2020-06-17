[![npm version](https://badge.fury.io/js/json-rql.svg)](https://badge.fury.io/js/json-rql)
[![Build Status](https://travis-ci.org/gsvarovsky/json-rql.svg?branch=master)](https://travis-ci.org/gsvarovsky/json-rql)
[![Try json-rql on RunKit](https://badge.runkitcdn.com/json-rql.svg)](https://npm.runkit.com/json-rql)
# json-rql
*JSON Resource Query Language, for simple, consistent query APIs*

This repository and library presents a *convention* for expressing queries against structured resources, using JSON. It helps resolve the tensions between *expressibility* and *simplicity*, and between *agility* and *future-proofing*, in API design. It is based on [JSON-LD](https://json-ld.org).

A simple example query:
```json
{ "@where" : { "@type" : "Person", "name" : { "@contains" : "Fred" } } }
```

1. It's JSON: straightforward to construct in code, manipulate and serialize, and also to *constrain*. Use standard JSON tooling to limit your API to the queries that your back-end has been designed and tested for.
2. It's SPARQL: *in context*, all queries can be translated to the W3C standard language for directed, labeled graph data. This means that your API can be extended to cover future query requirements, without breaking changes.

Please see [the wiki](https://github.com/gsvarovsky/json-rql/wiki) for an explanation of these design choices, and for a walkthrough of common query types.

**[Feedback](https://github.com/gsvarovsky/json-rql/issues) and contributions welcome!**

## SPARQL Translation
This library demonstrates and tests interconvertibility of **json-rql** and SPARQL. It can be used directly in a Javascript environment to translate queries, for example in an API implementation where the back-end supports SPARQL.

*Requires a modern browser / Node.js v10+*

```javascript
require('json-rql').toSparql({
  '@select' : '?s',
  '@where' : { '@id' : '?s', '?p' : '?o' }
}, function (err, sparql) {
  // sparql => SELECT ?s WHERE { ?s ?p ?o. }
});
```

For translation into SPARQL, a **json-rql** query typically requires a `@select`, `@construct` or `@describe` clause, and a `@context` to provide the mapping between terms and IRIs. When used in an API, these elements will often derive from the call context.

SPARQL language keywords supported so far can be found in [spec/keywords.json](spec/keywords.json).

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

## Biblio
* [JSON-LD Home](http://json-ld.org/)
* [JSON-LD Specification](http://json-ld.org/spec/latest/json-ld/)
* [SPARQL](https://www.w3.org/TR/rdf-sparql-query)
* [SPARQL.js](https://github.com/RubenVerborgh/SPARQL.js)
* [SPARQL Transformer](https://github.com/D2KLab/sparql-transformer) (a similar approach, "... writing in a single file the query and the expected output in JSON.")
* [JSON Schema](http://json-schema.org/)
* [Joi](https://github.com/hapijs/joi)
* [Jackson](https://github.com/FasterXML/jackson)
* [Resource Query Language (URL query-based)](https://github.com/persvr/rql)
