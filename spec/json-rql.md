[![github](https://img.shields.io/badge/gsvarovsky-json--rql-red?logo=github)](https://github.com/gsvarovsky/json-rql)
[![licence](https://img.shields.io/github/license/gsvarovsky/json-rql)](https://github.com/gsvarovsky/json-rql/blob/master/LICENSE)
[![npm](https://img.shields.io/npm/v/json-rql)](https://www.npmjs.com/package/json-rql)

# json-rql
*JSON Resource Query Language, for simple, consistent query APIs*

**json-rql** is a *convention* for expressing queries against structured
resources, using JSON. It helps resolve the tensions between *expressibility*
and *simplicity*, and between *agility* and *future-proofing*, in API design. It
is based on [JSON-LD](https://json-ld.org).

A simple example query:
```json
{ "@where" : { "@type" : "Person", "birthPlace" : { "name": { "@contains" : "London" } } } }
```

1. It's [JSON](json.org): straightforward to construct in code, manipulate and
   serialize, and also to *constrain*. Use standard JSON tooling such as
   [JSON schema](schema.json) to limit your API to the queries that your
   back-end has been designed and tested for.
2. It's [SPARQL](https://www.w3.org/TR/sparql11-query/): *in context*, all
   queries can be translated to the W3C standard language for directed, labeled
   graph data. This means that your API can be extended to cover future query
   requirements, without breaking changes.

See the project [wiki](https://github.com/gsvarovsky/json-rql/wiki) for more
discussion of the motivation behind **json-rql**.

## syntax
*Hint: links are provided to examples in the tests. Note that for now these
tests are rather SPARQL-ish, in that they make extensive use of prefixes and
IRIs. Your API doesn't have to use these much, if at all. Also linked are
various SPARQL and JSON-LD definitions. Again, you generally don't have to
follow these links to be able to use **json-rql** effectively; the examples
given should be sufficiently explanatory.*