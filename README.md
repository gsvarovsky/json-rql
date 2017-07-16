[![Build Status](https://travis-ci.org/gsvarovsky/json-rql.svg?branch=master)](https://travis-ci.org/gsvarovsky/json-rql)
[![GitHub stars](https://img.shields.io/github/stars/gsvarovsky/json-rql.svg)](https://github.com/gsvarovsky/json-rql/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/gsvarovsky/json-rql.svg)](https://github.com/gsvarovsky/json-rql/issues)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/gsvarovsky/json-rql/master/LICENSE)
# json-rql
_JSON RDF Query Language, a JSON-LD based SPARQL serialisation_

Actually, just a wrapper around [SPARQL.js](https://github.com/RubenVerborgh/SPARQL.js)
that conforms in syntax and spirit with [JSON-LD](http://json-ld.org/).

```javascript
require('json-rql').toSparql({
  '@select' : ['?s'],
  '@where' : { '@id' : '?s', '?p' : '?o' }
}, function (err, sparql) {
  // sparql => SELECT ?s WHERE { ?s ?p ?o. }
});
```

This is intended to be useful in constructing SPARQL expressions in Javascript.
[Feedback](https://github.com/gsvarovsky/json-rql/issues) and contributions welcome!

The syntax follows as closely as possible to [SPARQL](https://www.w3.org/TR/rdf-sparql-query), using
JSON-LD-style (camelcase) keywords for SPARQL language keywords. Supported so far are:

`SELECT`, `CONSTRUCT`, `WHERE`, `FILTER`, `OPTIONAL`, `UNION`, `ORDER BY`, `LIMIT`, `OFFSET`

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
Notice that the `@where` clause is _nested_. This is the advantage of JSON-LD, coming to SPARQL:
it's more natural to read and author related clauses when they can be in-lined, rather than having to
visually grep for triples related by variable names in a list.

See the tests (especially the JSON files in test/sparql) for more examples.

## Rules and Gotchas
* Use `@distinct` for `SELECT DISTINCT`
* `@where` is an object which is either just one JSON-LD (nested) object, or a `@graph`, plus any
other required clauses like `@filter`, `@optional` etc.

## Operators
Operator expressions are an object with one key (the operator), whose value is the operator arguments; e.g. `{ '@regex' : ['?label', 'word'] }`.

The supported operators can be found in [operators.json](lib/operators.json).

## But also...
You know what's exciting about this?

Imagine for a second that you had a document index like [elasticsearch](https://www.elastic.co/products/elasticsearch) containing Artists, and their birthplaces as nested documents. Well, then you could trivially translate the JSON example above into an elasticsearch query.

Let's say further that you have several such indexes for different document shapes, as well as a Triplestore; with all of this fronted by an API accepting **json-rql**. Your API gateway can then pattern-match the requests against the document structure of your indexes, and quickly choose the optimal one, falling back on the Triplestore if no matching one exists.

Now, this might not be the right thing for production, after all, it effectively means your API is contracted to respond to arbitrary SPARQL queries. However, using this pattern during _development_ means you can decouple your client team from your back-end team. The client team can come up with whatever queries they like, and the back-end team can watch the performance tests in the CI pipeline and optimise the indexes to suit. Then, as the product reaches viability, the Triplestore umbilical can be snipped off, and the API will start responding with `501 Not Implemented` to queries for which it does not have an index.

Combine this with [JSON-LD Framing](http://json-ld.org/spec/latest/json-ld-framing/) for the returned documents, and this is very similar to the thinking underlying [GraphQL](http://graphql.org/), but with Semantic Web tech.

## References
* [SPARQL.js](https://github.com/RubenVerborgh/SPARQL.js)
* [JSON-LD Home](http://json-ld.org/)
* [JSON-LD Specification](http://json-ld.org/spec/latest/json-ld/)
* [SPARQL](https://www.w3.org/TR/rdf-sparql-query)
* [elasticsearch](https://www.elastic.co/products/elasticsearch)
