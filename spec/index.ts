import { Iri } from "jsonld/jsonld-spec";

/**
 * @see https://json-ld.org/schemas/jsonld-schema.json
 */

/**
 * A query variable, prefixed with "?"
 * @see https://www.w3.org/TR/sparql11-query/#QSynVariables
 */
export type Variable = string;

export interface Pattern {
  '@context'?: Context
}

export type TermDef = Iri | ExpandedTermDef;

export interface ExpandedTermDef {
  '@id'?: Iri;
  /**
   * Used to express reverse properties.
   */
  '@reverse'?: TermDef;
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
   * @see https://json-ld.org/spec/latest/json-ld/#base-iri
   */
  '@base'?: Iri;
  /**
   * Used to expand properties and values in @type with a common prefix IRI
   * @see https://json-ld.org/spec/latest/json-ld/#default-vocabulary
   */
  '@vocab'?: Iri;
  /**
   * Defines a default language for a JSON-LD document
   * @see https://json-ld.org/spec/latest/json-ld/#string-internationalization
   */
  '@language'?: string;
  /**
   * https://json-ld.org/spec/latest/json-ld/#iri-expansion-within-a-context
   */
  [key: string]: TermDef | undefined;
}

export interface ValueObject {
  /**
   * Used to specify the data that is associated with a particular property in
   * the graph.
   * @see https://json-ld.org/spec/latest/json-ld/#typed-values
   */
  '@value': number | string | boolean;
  /**
   * Used to set the data type of a node or typed value.
   * @see https://json-ld.org/spec/latest/json-ld/#typed-values
   * @see https://json-ld.org/spec/latest/json-ld/#type-coercion
   * @see https://json-ld.org/spec/latest/json-ld/#embedding
   */
  '@type'?: Iri;
  /**
   * Used to specify the language for a particular string value or the default
   * language of a JSON-LD document.
   */
  '@language'?: string;
  '@index'?: string;
}

export function isValueObject(value: JrqlValue): value is ValueObject {
  return typeof value == 'object' && '@value' in value;
}

export type Reference = { '@id': Iri; };

export function isReference(value: JrqlValue): value is Reference {
  return typeof value == 'object' && Object.keys(value).every(k => k === '@id');
}

export type JrqlValue = number | string | boolean | Subject | Reference | ValueObject;

/**
 * Used to express an ordered set of data.
 */
export interface List {
  '@list': JrqlValue | JrqlValue[];
}

/**
 * Used to express an unordered set of data and to ensure that values are always
 * represented as arrays.
 */
export interface Set {
  '@set': JrqlValue | JrqlValue[];
}

export interface Subject extends Pattern {
  /**
   * Used to uniquely identify things that are being described in the document
   * with IRIs or blank node identifiers.
   */
  '@id'?: Iri;
  '@type'?: Iri;
  // TODO: @reverse https://json-ld.org/spec/latest/json-ld/#reverse-properties
  [key: string]: JrqlValue | JrqlValue[] | List | Set | Context | undefined;
}

export function isSubject(p: Pattern): p is Subject {
  return !isGroup(p) && !isQuery(p);
}

/**
 * Used to express a graph.
 */
export interface Group extends Pattern {
  '@graph': Subject[] | Subject;
  //'@filter': TODO Expressions
}

export function isGroup(p: Pattern): p is Group {
  return '@graph' in p || '@filter' in p;
}

export type GroupLike = Subject[] | Subject | Group;

export function isGroupLike(pattern: Pattern[] | Pattern): pattern is GroupLike {
  return Array.isArray(pattern) ? pattern.every(isGroupLike) : !isQuery(pattern);
}

export function asGroup(g: GroupLike, context?: Context): Group {
  let group: Group;
  if ('@graph' in g) {
    group = g as Group;
  } else if (Array.isArray(g)) {
    // Cannot promote contexts
    group = { '@graph': g };
  } else {
    // Promote the subject's context to the group level
    const { '@context': subjectContext, ...subject } = g;
    context = { ...subjectContext, ...context };
    group = { '@graph': subject };
  }
  return context ? { '@context': context, ...group } : group;
}

export function asSubjects(g: GroupLike, context?: Context): Subject[] {
  // TODO: Apply the context to the subjects, if necessary
  return ([] as Subject[]).concat(asGroup(g)['@graph']);
}

export interface Query extends Pattern {
  '@where'?: Pattern[] | Pattern
}

export function isQuery(p: Pattern): p is Query {
  return isRead(p) || isUpdate(p);
}

export interface Read extends Query {
  orderBy?: string, // TODO: Operators & Functions
  limit?: number,
  offset?: number
}

export function isRead(p: Pattern): p is Read {
  return isDescribe(p) || isConstruct(p) || isDistinct(p) || isSelect(p);
}

export interface Describe extends Read {
  '@describe': Iri | Variable
}

export function isDescribe(p: Pattern): p is Describe {
  return '@describe' in p;
}

export interface Construct extends Read {
  '@construct': GroupLike
}

export function isConstruct(p: Pattern): p is Construct {
  return '@construct' in p;
}

export type Result = '*' | Variable

export interface Distinct extends Read {
  '@distinct': Result[] | Result
}

export function isDistinct(p: Pattern): p is Distinct {
  return '@distinct' in p;
}

export interface Select extends Read {
  '@select': Result[] | Result
}

export function isSelect(p: Pattern): p is Select {
  return '@select' in p;
}

export interface DeleteInsert<T extends GroupLike = GroupLike> {
  '@insert': T;
  '@delete': T;
}

export interface Update extends Query, Partial<DeleteInsert<GroupLike>> {
}

export function isUpdate(p: Pattern): p is Update {
  return '@insert' in p || '@delete' in p;
}
