
module.exports = {
  mode: 'file',
  out: '_site',
  theme: 'node_modules/@m-ld/typedoc-theme/bin/minimal',
  readme: 'spec/json-rql.md',
  includes: 'spec',
  includeDeclarations: true,
  excludeExternals: true,
  disableSources: true,
  includeVersion: true
}