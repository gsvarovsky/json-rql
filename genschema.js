const _path = require('path'),
  _fs = require('fs'),
  _tjs = require('typescript-json-schema'),
  stringify = require('json-stringify-pretty-compact');

const program = _tjs.programFromConfig(
  _path.resolve('tsconfig.json'));
const schema = _tjs.generateSchema(program, '*', {
  id: 'https://json-rql.org/schema.json'
});
schema.anyOf = [
  { $ref: "#/definitions/Subject" },
  { $ref: "#/definitions/Group" },
  { $ref: "#/definitions/Update" },
  { $ref: "#/definitions/Describe" },
  { $ref: "#/definitions/Construct" },
  { $ref: "#/definitions/Distinct" },
  { $ref: "#/definitions/Select" }
];
_fs.writeFileSync(_path.resolve('spec/schema.json'), stringify(schema), 'utf-8');
