const _path = require('path'),
  _fs = require('fs'),
  _tjs = require('typescript-json-schema'),
  stringify = require('json-stringify-pretty-compact');

const program = _tjs.getProgramFromFiles(
  [_path.resolve('spec/index.ts')]);
const schema = _tjs.generateSchema(program, '*', {
  id: 'https://json-rql.org/schema.json'
});
_fs.writeFileSync(_path.resolve('spec/schema.json'), stringify(schema), 'utf-8');
