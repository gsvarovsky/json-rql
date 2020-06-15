var _fs = require('fs'),
  _path = require('path'),
  download = require('download-git-repo'),
  sparqljsPackage = require('sparqljs/package.json'),
  sparqljsSrcFolder = _path.join(__dirname, '../node_modules/sparqljs-src'),
  sparqlFolder = _path.join(sparqljsSrcFolder, 'queries');

if (!_fs.existsSync(sparqlFolder)) {
  download('github:RubenVerborgh/SPARQL.js#v' + sparqljsPackage.version, sparqljsSrcFolder, function (err) {
    if (err)
      console.err(err);
    else
      console.log('Downloaded', sparqljsSrcFolder);
  });
} else {
  console.log(sparqljsSrcFolder, 'exists');
}
