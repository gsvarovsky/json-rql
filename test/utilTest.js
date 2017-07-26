var _ = require('lodash'),
    _util = require('../lib/util'),
    expect = require('chai').expect;

describe('AST utilities', function () {
    describe('Graph nesting', function () {
        it('should un-array a singleton graph', function () {
            var nested = _util.nestGraph([{ '@id': '_:a' }]);
            expect(nested).to.deep.equal({ '@id': '_:a' });
        });

        it('should leave a singleton graph alone', function () {
            var nested = _util.nestGraph({ '@id': '_:a' });
            expect(nested).to.deep.equal({ '@id': '_:a' });
        });

        it('should leave an already-nested graph alone', function () {
            var nested = _util.nestGraph([{ '@id': '_:a', b : { '@id': '_:b' } }]);
            expect(nested).to.deep.equal({ '@id': '_:a', b : { '@id': '_:b' } });
        });

        it('should nest one nested entity', function () {
            var nested = _util.nestGraph([
                { '@id': '_:a', b : { '@id': '_:b' } },
                { '@id': '_:b' }
            ]);
            expect(nested).to.deep.equal({ '@id': '_:a', b : { '@id': '_:b' } });
        });

        it('should preserve nested properties', function () {
            var nested = _util.nestGraph([
                { '@id': '_:a', b : { '@id': '_:b' } },
                { '@id': '_:b', p : 'p' }
            ]);
            expect(nested).to.deep.equal({ '@id': '_:a', b : { '@id': '_:b', p : 'p' } });
        });

        it('should preserve nested entities', function () {
            var nested = _util.nestGraph([
                { '@id': '_:a', b : { '@id': '_:b' } },
                { '@id': '_:b', c : { '@id' : '_:c' } }
            ]);
            expect(nested).to.deep.equal({ '@id': '_:a', b : { '@id': '_:b', c : { '@id' : '_:c' } } });
        });

        it('should recursively nest entities', function () {
            var nested = _util.nestGraph([
                { '@id': '_:a', b : { '@id': '_:b' } },
                { '@id': '_:b', c : { '@id' : '_:c' } },
                { '@id': '_:c', p : 'p' }
            ]);
            expect(nested).to.deep.equal({ '@id': '_:a', b : { '@id': '_:b', c : { '@id' : '_:c', p : 'p' } } });
        });
    });
});