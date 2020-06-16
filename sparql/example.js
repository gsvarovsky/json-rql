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
}, function (err, sparql) {
    // sparql => SELECT ?p ?c WHERE {
    //   ?c <http://xmlns.com/foaf/0.1/name> "York"@en.
    //   ?p <http://dbpedia.org/ontology/birthPlace> ?c.
    //   ?p <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://dbpedia.org/ontology/Artist>.
    // }
    console.log(err || sparql);
});
