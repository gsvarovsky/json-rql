const expect = require('chai').expect,
  _spec = require('../spec');

describe('json-rql Spec functions', function () {
  it('should identify a variable', function () {
    expect(_spec.isVariable(null)).to.eq(false);
    expect(_spec.isVariable('a')).to.eq(false);
    expect(_spec.isVariable({})).to.eq(false);
    expect(_spec.isVariable('?a')).to.eq(true);
    expect(_spec.isVariable('?a0')).to.eq(true);
  });

  it('should identify a value object', function () {
    expect(_spec.isValueObject('a')).to.eq(false);
    expect(_spec.isValueObject({})).to.eq(false);
    expect(_spec.isValueObject({ '@value': 1 })).to.eq(true);
  });
});
