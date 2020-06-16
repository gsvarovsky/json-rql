var _util = require('../sparql/util'),
    expect = require('chai').expect;

describe('AST utilities', function () {
    describe('Graph inlining', function () {
        it('should un-array a singleton graph', function () {
            var inlined = _util.inlineGraph([{ '@id': '_:a' }]);
            expect(inlined).to.deep.equal({ '@id': '_:a' });
        });

        it('should leave a singleton graph alone', function () {
            var inlined = _util.inlineGraph({ '@id': '_:a' });
            expect(inlined).to.deep.equal({ '@id': '_:a' });
        });

        it('should leave an already-inlined graph alone', function () {
            var inlined = _util.inlineGraph([{ '@id': '_:a', b : { '@id': '_:b' } }]);
            expect(inlined).to.deep.equal({ '@id': '_:a', b : { '@id': '_:b' } });
        });

        it('should inline one inlined entity', function () {
            var inlined = _util.inlineGraph([
                { '@id': '_:a', b : { '@id': '_:b' } },
                { '@id': '_:b' }
            ]);
            expect(inlined).to.deep.equal({ '@id': '_:a', b : { '@id': '_:b' } });
        });

        it('should preserve inlined properties', function () {
            var inlined = _util.inlineGraph([
                { '@id': '_:a', b : { '@id': '_:b' } },
                { '@id': '_:b', p : 'p' }
            ]);
            expect(inlined).to.deep.equal({ '@id': '_:a', b : { '@id': '_:b', p : 'p' } });
        });

        it('should preserve inlined entities', function () {
            var inlined = _util.inlineGraph([
                { '@id': '_:a', b : { '@id' : '_:b' } },
                { '@id': '_:b', c : { '@id' : '_:c' } }
            ]);
            expect(inlined).to.deep.equal({ '@id': '_:a', b : { '@id': '_:b', c : { '@id' : '_:c' } } });
        });

        it('should recursively inline entities', function () {
            var inlined = _util.inlineGraph([
                { '@id': '_:a', b : { '@id' : '_:b' } },
                { '@id': '_:b', c : { '@id' : '_:c' } },
                { '@id': '_:c', p : 'p' }
            ]);
            expect(inlined).to.deep.equal({ '@id': '_:a', b : { '@id': '_:b', c : { '@id' : '_:c', p : 'p' } } });
        });
        
        it('should not inline when there are multiple references', function () {
            var inlined = _util.inlineGraph([
                { '@id': '_:a', b : { '@id' : '_:c' } },
                { '@id': '_:b', c : { '@id' : '_:c' } },
                { '@id': '_:c', p : 'p' }
            ]);
            expect(inlined).to.deep.equal([
                { '@id': '_:a', b : { '@id' : '_:c' } },
                { '@id': '_:b', c : { '@id' : '_:c' } },
                { '@id': '_:c', p : 'p' }
            ]);
        });
    });

    describe('Filter inlining', function () {
        it('should inline a property value filter', function () {
            var filters = [{ '@gt' : ['?v', 1] }];
            var inlined = _util.inlineFilters([{ 'p' : '?v' }], filters);
            expect(inlined).to.deep.equal({ 'p' : { '@id' : '?v', '@gt' : 1 } });
            expect(filters).to.deep.equal([]);
        });

        it('should not inline a property value filter if multiply referenced', function () {
            var filters = [{ '@gt' : ['?v', 1] }];
            var inlined = _util.inlineFilters([{ 'p' : '?v' }, { 'p2' : '?v' }], filters);
            expect(inlined).to.deep.equal([{ 'p' : '?v' }, { 'p2' : '?v' }]);
            expect(filters).to.deep.equal([{ '@gt' : ['?v', 1] }]);
        });
    });
});