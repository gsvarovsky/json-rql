# json-rql
_JSON RDF Query Language, a JSON-LD based SPARQL serialisation_

Actually, just a minimal wrapper around [SPARQL.js](https://github.com/RubenVerborgh/SPARQL.js)
that allows BGP triples to be specified using [JSON-LD](http://json-ld.org/).

```javascript
require('json-rql').toSparql({
  variables : ['?s'],
  where : { '@id' : '?s', '?p' : '?o' }
}, function (err, sparql) {
  // sparql => SELECT ?s WHERE { ?s ?p ?o. }
});
```

This is intended to be useful in constructing SPARQL expressions in Javascript.
[Feedback](https://github.com/gsvarovsky/json-rql/issues) and contributions welcome!

The following bells and whistles apply:
* You can use an `@context` at the top level, instead of `prefixes`
* `type : 'query'` and `queryType : 'SELECT'` are defaults and can be omitted (as example above)
* A `where` or `updates` clause can be a single JSON-LD object (as example above) or an array of JSON-LD objects
  * no need for an additional layer with `type` and `triples`
  * default `type` for an update is `'insertdelete'`

Using the [example](https://www.npmjs.com/package/sparqljs#representation) from SPARQL.js:
```javascript
require('json-rql').toSparql({
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
},function (err, sparql) {
  // sparql => SELECT ?p ?c WHERE {
  //   ?c <http://xmlns.com/foaf/0.1/name> "York"@en.
  //   ?p <http://dbpedia.org/ontology/birthPlace> ?c.
  //   ?p <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://dbpedia.org/ontology/Artist>.
  // }
});
```

See the tests for more examples.