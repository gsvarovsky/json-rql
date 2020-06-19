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
Here we describe the syntax of **json-rql** informally in terms of JSON
constructs (hashes and keys), for introductory purposes. The formal type
definitions below and in the navigation panel on the left gives a more formal
specification.

*Hint: links are provided from keywords to examples. Note that these are rather
SPARQL-ish, in that they make extensive use of prefixes and IRIs. An API doesn't
have to use these much, if at all. Also linked in the formal type documentation
are various SPARQL and JSON-LD definitions. Again, you generally don't have to
follow these links to be able to use **json-rql** effectively; the examples
given should be sufficiently explanatory.*

### [Pattern](interfaces/pattern.html)
All **json-rql** queries are an object/hash at top level (one of the sub-types
of Pattern). All the recognised keys of this hash are keywords, which start with
a `@`. However, any other keys can exist as required by the API design, such as
a name or description for the query.

The recognised query keys are:
1. [`@context`](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=context&type=Code):
   A [JSON-LD Context](https://json-ld.org/spec/latest/json-ld/#the-context) for
   the query. In an API this is likely to be implicit. For example, using
   **json-rql** as the body of a `POST` to
   `http://example.com/my-api/v1/person/query` might have the implicit context
   of a Person (possibly found at `http://example.com/my-api/v1/person`). As a
   user of the API, therefore, you may not need to consider the Context.
2. One of four options for the returned data. Again, in a typical API the choice
   will often be implicit, and the key omitted.
   * [`@construct`](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=construct&type=Code)
     specifies a [Subject](interfaces/Subject.html) for the requested data,
     using [Variables](#variable) to place-hold data matched by the `@where`
     clause.
   * [`@describe`](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=describe&type=Code)
     specifies an IRI, a [Variable](#variable), or an array of either. Each
     matched value will be output in some suitable expanded format, such as an
     entity with its top-level properties.
   * [`@select`](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=select&type=Code)
     specifies a [Result](#result), which defines a set of outputs. The output
     will be a table of atomic values.
   * [`@distinct`](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=distinct&type=Code)
     is like `@select` but returns only unique rows.
3. [`@where`](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=where&type=Code)
   specifies a [Pattern](interfaces/pattern.html) to match, or an array of
   Patterns to match. Each can be a [Subject](interfaces/subject.html), a
   [Group](interfaces/group.html), or another query (a sub-query).
4. [`@orderBy`](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=orderBy&type=Code)
   specifies an [Expression](#expression) or array of expressions to order the results by.
5. [`@groupBy`](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=groupBy&type=Code)
   specifies an [Expression](#expression) or an array of expressions to group
   the result by.
6. [`@having`](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=having&type=Code)
   specifies an [Expression](#expression) to filter individual grouped-by
   members.
7. [`@values`](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=values&type=Code)
   specifies a [Variable Expression](interfaces/variableexpression.html) or
   array of Variable Expressions that define inline allowable value combinations
   for the query variables.
8. `@limit` and `@offset` specify integer paging for the results.

### [Subject](interfaces/subject.html)
This is a JSON-LD object with the following non-compliances:
1. Object keys and values can be [Variables](#variable) like `"?variable"`.
2. Values can be [in-line filters](#inlinefilter), of the form `{ <operator> : <Expression> }`.
   The [operator](#operators) is acting as an infix, and in this case the
   Expression represents only the RHS. The object may specify a variable to be
   matched against the filter by including an `@id` key as well as the operator,
   like this: `{ "@id" : "?variable", <operator> : <Expression> }`.

### [Group](interfaces/group.html)
A Group object has one or more of the following keys:
1. [`@graph`](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=graph&type=Code)
   specifies a [Subject](interfaces/subject.html) or an array of Subjects to match.
2. [`@filter`](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=filter&type=Code)
   specifies a [Constraint](interfaces/constraint.html) or an array of
   Constraints, each of the form `{ <operator> : [<Expression>...] }`. Note that
   filters can also be specified in-line inside a Subject, see above.
3. [`@union`](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=union&type=Code)
   specifies an array of alternative Patterns (Subject, Group or query) to
   match.
4. [`@optional`](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=optional&type=Code)
   specifies a Group that may or may not match.

### [Expression](#expression)
An Expression can be
1. a [Variable](#variable) like `"?variable"`,
2. a literal in JSON's native data types, i.e., number, strings, and booleans,
3. a [JSON-LD value object](interfaces/valueobject.html), or
4. a [Constraint](interfaces/constraint.html) of the form `{ <operator> : [<Expression>...] }`.
   The key is the [operator](#operators), and the value is the array of
   arguments. If the operator is unary, the Expression need not be wrapped in an
   array.

### [Variable Expression](interfaces/variableexpression.html)
A variable Expression is either a plain variable (e.g. `"?size"`), or an object
whose keys are variables, and whose values are expressions whose result will be
assigned to the variable, e.g.
```json
{ "?averageSize" : { "@avg" : "?size" } }
```