import { Iri } from 'jsonld/jsonld-spec';

/**
 * @see https://json-ld.org/schemas/jsonld-schema.json
 */

export const operators = {
  '@eq': { sparql: '=' },
  '@gt': { sparql: '>' },
  '@lt': { sparql: '<' },
  '@gte': { sparql: '>=' },
  '@lte': { sparql: '<=' },
  '@not': { sparql: '!' },
  '@neq': { sparql: '!=' },
  '@and': { sparql: '&&', associative: true },
  '@or': { sparql: '||', associative: true },
  '@plus': { sparql: '+' },
  '@minus': { sparql: '-' },
  '@times': { sparql: '*' },
  '@divide': { sparql: '/' },
  '@bound': { sparql: 'bound' },
  '@regex': { sparql: 'regex' },
  '@in': { sparql: 'in' },
  '@notin': { sparql: 'notin' },
  '@str': { sparql: 'str' },
  '@lang': { sparql: 'lang' },
  '@langmatches': { sparql: 'langmatches' },
  '@count': { sparql: 'count', aggregation: true },
  '@sum': { sparql: 'sum', aggregation: true },
  '@min': { sparql: 'min', aggregation: true },
  '@max': { sparql: 'max', aggregation: true },
  '@avg': { sparql: 'avg', aggregation: true },
  '@groupConcat': { sparql: 'group_concat', aggregation: true },
  '@sample': { sparql: 'sample', aggregation: true },
  '@desc': { sparql: 'descending' },
  '@asc': { sparql: 'ascending' }
};

export const clauses = {
  '@construct': { sparql: 'construct' },
  '@select': { sparql: 'select' },
  '@describe': { sparql: 'describe' },
  '@distinct': { sparql: 'distinct' },
  '@where': { sparql: 'where' },
  '@orderBy': { sparql: 'order by' },
  '@groupBy': { sparql: 'group by' },
  '@having': { sparql: 'having' },
  '@limit': { sparql: 'limit' },
  '@offset': { sparql: 'offset' },
  '@values': { sparql: 'values' }
};

export const groupPatterns = {
  '@graph': { sparql: null },
  '@bind': { sparql: 'bind' },
  '@filter': { sparql: 'filter' },
  '@union': { sparql: 'union' },
  '@optional': { sparql: 'optional' },
  '@values': { sparql: 'values' }
};

/**
 * A query variable, prefixed with "?"
 * @see [SPARQL Variables](https://www.w3.org/TR/sparql11-query/#QSynVariables)
 */
export type Variable = string;

export function isVariable(value: any): value is Variable {
  return typeof value == 'string' && !!/^\?([\d\w]+)$/g.exec(value);
}

/**
 * All **json-rql** queries have an object/hash Pattern at top level. All the
 * keys of this hash recognised by **json-rql** are keywords, which start with a
 * `@`. However, any other keys can exist as required by the API design, such as
 * a name or description for the query.
 */
export interface Pattern {
  /**
   * A [JSON-LD Context](https://w3c.github.io/json-ld-syntax/#the-context)
   * for the query. In an API, this will frequently be implicit. For example,
   * using **json-rql** as the body of a `POST` to
   * `http://example.com/my-api/v1/person/query` might have the implicit context
   * of a Person (possibly found at `http://example.com/my-api/v1/person`).
   * @see [examples](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=context&type=Code)
   */
  '@context'?: Context
}

/**
 * A term definition is an entry in a context, where the key defines a term
 * which may be used within a JSON object as a property, type, or elsewhere that
 * a string is interpreted as a vocabulary item. Its value is either a string
 * (simple term definition), expanding to an absolute IRI, or an expanded term
 * definition.
 * @see [JSON-LD&nbsp;dfn-term-definition](https://w3c.github.io/json-ld-syntax/#dfn-term-definition)
 */
export type TermDef = Iri | ExpandedTermDef;

/**
 * An expanded term definition, is a term definition where the value is a JSON
 * object containing one or more keyword properties to define the associated
 * absolute IRI, if this is a reverse property, the type associated with string
 * values, and a container mapping.
 * @see [JSON-LD&nbsp;dfn-expanded-term-definition](https://w3c.github.io/json-ld-syntax/#dfn-expanded-term-definition)
 */
export interface ExpandedTermDef {
  '@id'?: Iri;
  /**
   * Used to express reverse properties.
   */
  '@reverse'?: TermDef;
  /**
   * Used to set the data type of a node or typed value.
   * @see [JSON-LD typed-values](https://w3c.github.io/json-ld-syntax/#typed-values)
   * @see [JSON-LD type-coercion](https://w3c.github.io/json-ld-syntax/#type-coercion)
   */
  '@type'?: Iri;
  '@language'?: string;
  /**
   * Used to set the default container type for a term.
   */
  '@container'?: '@list' | '@set' | '@language' | '@index';
}

/**
 * Used to define the short-hand names that are used throughout a JSON-LD
 * document.
 */
export interface Context {
  /**
   * Used to set the base IRI against which relative IRIs are resolved
   * @see [JSON-LD base-iri](https://w3c.github.io/json-ld-syntax/#base-iri)
   */
  '@base'?: Iri;
  /**
   * Used to expand properties and values in @type with a common prefix IRI
   * @see [JSON-LD default-vocabulary](https://w3c.github.io/json-ld-syntax/#default-vocabulary)
   */
  '@vocab'?: Iri;
  /**
   * Defines a default language for a JSON-LD document
   * @see [JSON-LD&nbsp;string-internationalization](https://w3c.github.io/json-ld-syntax/#string-internationalization)
   */
  '@language'?: string;
  /**
   * @see [JSON-LD&nbsp;iri-expansion-within-a-context](https://w3c.github.io/json-ld-syntax/#iri-expansion-within-a-context)
   */
  [key: string]: TermDef | undefined;
}

/**
 * @see [JSON-LD dfn-value-object](https://w3c.github.io/json-ld-syntax/#dfn-value-object)
 */
export interface ValueObject {
  /**
   * Used to specify the data that is associated with a particular property in
   * the graph. Note that in **json-rql** a `@value` will never be a variable.
   * @see [JSON-LD typed-values](https://w3c.github.io/json-ld-syntax/#typed-values)
   */
  '@value': number | string | boolean;
  /**
   * Used to set the data type of the typed value.
   * @see [JSON-LD typed-values](https://w3c.github.io/json-ld-syntax/#typed-values)
   * @see [JSON-LD type-coercion](https://w3c.github.io/json-ld-syntax/#type-coercion)
   */
  '@type'?: Iri;
  /**
   * Used to specify the language for a particular string value or the default
   * language of a JSON-LD document.
   */
  '@language'?: string;
  '@index'?: string;
}

export function isValueObject(value: SubjectPropertyObject): value is ValueObject {
  return typeof value == 'object' && '@value' in value;
}

/**
 * A node object used to reference a node having only the `@id` key.
 * @see [JSON-LD&nbsp;dfn-node-reference](https://w3c.github.io/json-ld-syntax/#dfn-node-reference)
 */
export type Reference = { '@id': Iri; };

export function isReference(value: SubjectPropertyObject): value is Reference {
  return typeof value == 'object' && Object.keys(value).every(k => k === '@id');
}

/**
 * Like a {@link Reference}, but used for "vocabulary" references. These are relevant to:
 * - Subject properties: the property name is a vocabulary reference
 * - Subject `@type`: the type value is a vocabulary reference
 * - Any value for a property that has been defined as `@vocab` in the Context
 * @see [JSON-LD&nbsp;Default&nbsp;Vocabulary](https://www.w3.org/TR/json-ld/#default-vocabulary)
 */
export type VocabReference = { '@vocab': Iri };

export function isVocabReference(value: SubjectPropertyObject): value is VocabReference {
  return typeof value == 'object' && Object.keys(value).every(k => k === '@vocab');
}

/**
 * A basic atomic value used as a concrete value or in a filter.
 */
export type Atom = number | string | boolean | Variable | ValueObject | Reference | VocabReference;

export function isAtom(value: SubjectPropertyObject): value is Atom {
  return typeof value == 'number'
    || typeof value == 'string'
    || typeof value == 'boolean'
    || isValueObject(value)
    || isReference(value)
    || isVocabReference(value);
}

/**
 * A value that can be assigned as the target of a graph edge.
 */
export type Value = Atom | Subject;

/**
 * A stand-in for a Value used as a basis for filtering. An expression can be
 * 1. a [variable](https://www.w3.org/TR/sparql11-query/#QSynVariables) like `"?variable"`,
 * 2. a literal in JSON's native data types, i.e., number, strings, and booleans,
 * 3. a [JSON-LD value object](https://w3c.github.io/json-ld-syntax/#value-objects), or
 * 4. a constraint of the form `{ <operator> : [<expression>...] }`.
 */
export type Expression = Atom | Constraint;

export function isExpression(value: any): value is Expression {
  return isAtom(value) || isConstraint(value);
}

/**
 * An operator-based constraint of the form `{ <operator> : [<expression>...]
 * }`. The key is the operator, and the value is the array of arguments. If the
 * operator is unary, the expression need not be wrapped in an array.
 * @see [SPARQL expressions](https://www.w3.org/TR/2013/REC-sparql11-query-20130321/#expressions)
 */
export interface Constraint {
  /**
   * Used only for aggregation operators
   * @see [SPARQL aggregates](https://www.w3.org/TR/2013/REC-sparql11-query-20130321/#aggregates)
   */
  '@distinct'?: boolean;
  /**
   * Operators are based on SPARQL expression keywords, lowercase with '@' prefix.
   * It's not practical to constrain the types further here, see #isConstraint
   * @see [SPARQL&nbsp;rConditionalOrExpression](https://www.w3.org/TR/2013/REC-sparql11-query-20130321/#rConditionalOrExpression)
   */
  [operator: string]: Expression | Expression[] | Group | '*' | null | boolean | undefined;
}

export function isConstraint(value: object): value is Constraint {
  return Object.keys(value).filter(k => k !== '@distinct').every(key => key in operators);
}

/**
 * An in-line filter, of the form `{ <operator> : <expression> }`. The operator
 * is acting as an infix, and in this case the expression represents only the
 * RHS. The object may specify a variable to be matched against the filter by
 * including an `@id` key as well as the operator, like this:
 * `{ "@id" : "?variable", <operator> : <expression> }`.
 */
export type InlineFilter = { '@id'?: Variable } & Constraint;

/**
 * The allowable types for a Subject property value, named awkwardly to avoid
 * overloading `Object`. Represents the "object" of a property, in the sense of
 * the object of discourse, whether it be a concrete value or a filter.
 */
export type SubjectPropertyObject = Value | Container | InlineFilter | SubjectPropertyObject[];

/**
 * Used to express an ordered or unordered container of data.
 * @see [JSON-LD sets-and-lists](https://w3c.github.io/json-ld-syntax/#sets-and-lists)
 */
export type Container = List | Set;

/**
 * Used to express an ordered set of data. A List object is reified to a Subject
 * (unlike in JSON-LD) and so it has an @id, which can be set by the user.
 *
 * Note that this reification is only possible when using the `@list` keyword,
 * and not if the active context specifies `"@container": "@list"` for a
 * property, in which case the list itself is anonymous.
 * @see [JSON-LD sets-and-lists](https://w3c.github.io/json-ld-syntax/#sets-and-lists)
 */
export interface List extends Subject {
  '@list': SubjectPropertyObject;
}

export function isList(value: SubjectPropertyObject): value is List {
  return typeof (value) === 'object' && '@list' in value;
}

/**
 * Used to express an unordered set of data and to ensure that values are always
 * represented as arrays.
 * @see [JSON-LD sets-and-lists](https://w3c.github.io/json-ld-syntax/#sets-and-lists)
 */
export interface Set {
  '@set': SubjectPropertyObject;
}

export function isSet(value: SubjectPropertyObject): value is Set {
  return typeof (value) === 'object' && '@set' in value;
}

/**
 * Represents some graph content. This is like a JSON-LD object with the
 * following non-compliances:
 * 1. Object keys and values can be
 *    [variables](https://www.w3.org/TR/sparql11-query/#QSynVariables) like
 *    `"?variable"`.
 * 2. Values can be in-line filters, of the form `{ <operator> : <expression> }`.
 *    The operator is acting as an infix, and in this case the expression
 *    represents only the RHS. The object may specify a variable to be matched
 *    against the filter by including an `@id` key as well as the operator, like
 *    this: `{ '@id' : "?variable", <operator> : <expression> }`.
 */
export interface Subject extends Pattern {
  /**
   * Used to uniquely identify things that are being described in the document
   * with IRIs or blank node identifiers.
   */
  '@id'?: Iri | Variable | InlineFilter;
  /**
   * Used to set the data type of a node or typed value.
   * @see [JSON-LD specifying-the-type](https://w3c.github.io/json-ld-syntax/#specifying-the-type)
   */
  '@type'?: Iri | Variable | Iri[] | Variable[] | InlineFilter;
  /**
   * Specifies a graph edge, that is, a mapping from the `@id` of this JSON
   * object to one or more values, which may also express constraints.
   * @see [JSON-LD embedding](https://w3c.github.io/json-ld-syntax/#embedding)
   */
  [key: string]: SubjectPropertyObject | Context | undefined;
  // TODO: @reverse [JSON-LD reverse-properties](https://w3c.github.io/json-ld-syntax/#reverse-properties)
}

/**
 * Determines whether the given property object from a well-formed Subject is a
 * graph edge; i.e. not a `@context` or the Subject `@id`.
 * @param property the Subject property in question
 * @param object the object (value) of the property
 */
export function isPropertyObject(property: string, object: Subject['any']):
  object is SubjectPropertyObject {
  return property !== '@context' && property !== '@id' && object != null;
}

export function isSubject(p: Pattern): p is Subject {
  return !isGroup(p) && !isQuery(p);
}

/**
 * Used to express a group of patterns to match.
 */
export interface Group extends Pattern {
  /**
   * Specifies a Subject or an array of Subjects to match.
   * @see [examples](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=graph&type=Code)
   */
  '@graph'?: Subject | Subject[];
  /**
   * Specifies a filter or an array of filters, each of the form `{ <operator> :
   * [<expression>...] }`. Note that filters can also be specified in-line
   * inside a Subject.
   * @see [examples](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=filter&type=Code)
   */
  '@filter'?: Constraint | Constraint[];
  /**
   * Specifies an array of alternative patterns (Subject, Group or Query) to match.
   * @see [examples](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=union&type=Code)
   */
  '@union'?: Pattern[];
  /**
   * Specifies a Group that may or may not match.
   * @see [examples](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=optional&type=Code)
   */
  '@optional'?: Group;
  /**
   * Specifies a Variable Expression or array of Variable Expressions that
   * define [inline allowable value combinations] for this Group.
   * @see [SPARQL inline-data](https://www.w3.org/TR/2013/REC-sparql11-query-20130321/#inline-data)
   */
  '@values'?: VariableExpression | VariableExpression[];
}

export function isGroup(p: Pattern): p is Group {
  return '@graph' in p || '@filter' in p || '@union' in p || '@optional' in p ||
    ('@values' in p && !isQuery(p)); // Queries can also have @values
}

export interface Query extends Pattern {
  /**
   * specifies a pattern to match, or an array of patterns to match. Each can be
   * a Subject, a Group, or another Query (a sub-query).
   * @see [examples](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=where&type=Code)
   */
  '@where'?: Pattern[] | Pattern
  /**
   * Specifies a Variable Expression or array of Variable Expressions that
   * define [inline allowable value combinations]. This is a short-hand for
   * including values in {@link Group}s in the `@where` clause.
   * @see [SPARQL inline-data](https://www.w3.org/TR/2013/REC-sparql11-query-20130321/#inline-data)
   * @see [examples](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=values&type=Code)
   */
  '@values'?: VariableExpression | VariableExpression[];
}

export function isQuery(p: Pattern): p is Query {
  return isRead(p) || isUpdate(p);
}

export interface Read extends Query {
  /**
   * Specifies an expression or array of expressions to order the results by.
   * @see [examples](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=orderBy&type=Code)
   */
  '@orderBy'?: Expression | Expression[],
  /**
   * Specifies an expression or an array of expressions to [group the result
   * by](https://www.w3.org/TR/sparql11-query/#groupby).
   * @see [examples](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=groupBy&type=Code)
   */
  '@groupBy'?: Expression | Expression[],
  /**
   * Specifies an expression to [filter individual grouped-by
   * members](https://www.w3.org/TR/sparql11-query/#having).
   * @see [examples](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=having&type=Code)
   */
  '@having'?: Expression,
  /**
   * Integer page size limit for results
   */
  '@limit'?: number,
  /**
   * Integer offset for results
   */
  '@offset'?: number
}

export function isRead(p: Pattern): p is Read {
  return isDescribe(p) || isConstruct(p) || isDistinct(p) || isSelect(p);
}

/**
 * Determines if a Pattern can be used as a top-level object to perform a write
 * against a data set. A writeable Pattern can be:
 * - A Subject with no variables in key or value positions, recursively
 * - A Group with only a `@graph` key, containing writeable Subjects
 * - An Update
 *
 * This check does not guarantee that any updates will actually be made. It also
 * leaves a class of Patterns that are neither Reads nor Writeable. Such
 * patterns should not be accepted by a data store as a transaction.
 *
 * An implementation may wish to leave the scan for variables until query
 * processing, for efficiency; if so, pass the 'quick' parameter.
 */
export function isWritable(p: Pattern, quick?: 'quick'): p is Subject | Group | Update {
  if (isRead(p))
    return false;
  // Do a full tree walk to find variables, ignoring `@value` keys
  function isWritableValue(o: any): boolean {
    if (quick)
      return true;
    else if (typeof o == 'object')
      if (Array.isArray(o))
        return o.every(isWritableValue);
      else
        return Object.keys(o).every(k =>
          !isVariable(k) && (k === '@value' || isWritableValue(o[k])));
    else
      return !isVariable(o);
  }
  if (isSubject(p)) {
    return isWritableValue(p);
  } else if (isGroup(p)) {
    return !('@filter' in p || '@union' in p || '@optional' in p) &&
      p['@graph'] != null && isWritableValue(p['@graph'])
  } else {
    return isUpdate(p);
  }
}

/**
 * A variable expression an object whose keys are variables, and whose values
 * are expressions whose result will be assigned to the variable, e.g.
 * ```json
 * { "?averageSize" : { '@avg' : "?size" } }
 * ```
 */
export interface VariableExpression {
  [key: string]: Expression;
}

export function isVariableExpression(value: any): value is VariableExpression {
  const keys = typeof value == 'object' ? Object.keys(value) : [];
  return keys.every(key => isVariable(key) && isExpression(value[key]));
}

export interface Describe extends Read {
  /**
   * Specifies a single Variable Expression or array of Variable Expressions.
   * Each matched datum for the identified variables will be output in some
   * suitable expanded format, such as an entity with its top-level properties.
   * @see [examples](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=describe&type=Code)
   */
  '@describe': Iri | Variable | (Iri | Variable)[]
}

export function isDescribe(p: Pattern): p is Describe {
  return '@describe' in p;
}

export interface Construct extends Read {
  /**
   * Specifies a Subject for the requested data, using variables to place-hold
   * data matched by the `@where` clause.
   * @see [examples](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=construct&type=Code)
   */
  '@construct': Subject | Subject[]
}

export function isConstruct(p: Pattern): p is Construct {
  return '@construct' in p;
}

export type Result = '*' | Variable | Variable[] | VariableExpression

export interface Distinct extends Read {
  /**
   * Like `@select` but returns only unique rows.
   */
  '@distinct': Result
}

export function isDistinct(p: Pattern): p is Distinct {
  return '@distinct' in p;
}

export interface Select extends Read {
  /**
   * Specifies a single Variable Expression or array of Variable Expressions.
   * The output will be a table of atomic values.
   * @see [examples](https://github.com/gsvarovsky/json-rql/search?l=JSON&q=select&type=Code)
   */
  '@select': Result
}

export function isSelect(p: Pattern): p is Select {
  return '@select' in p;
}

export interface Update extends Query {
  /**
   * Subjects with properties to be deleted from the domain.
   */
  '@delete': Subject | Subject[];
  /**
   * Subjects with properties to be inserted into the domain.
   */
  '@insert': Subject | Subject[];
}

export function isUpdate(p: Pattern): p is Update {
  return '@insert' in p || '@delete' in p;
}
