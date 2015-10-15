"use strict";

var nodeunit = require('nodeunit');
var fate = require('../build/fate');
var types = fate.Types;

exports.api = nodeunit.testCase({

  "Truthy / Falsy": function (test) {
    test.equal(types.isTruthy(null), false);
    test.equal(types.isTruthy(), false);
    test.equal(types.isTruthy([]), false);
    test.equal(types.isTruthy({}), false);
    test.equal(types.isTruthy({ name: 'fate' }), true);
    test.equal(types.isTruthy("hello"), true);
    test.equal(types.isTruthy([1]), true);
    test.equal(types.isFalsy(null), true);
    test.equal(types.isFalsy(), true);
    test.equal(types.isFalsy([]), true);
    test.equal(types.isFalsy({}), true);
    test.equal(types.isFalsy({ name: 'fate' }), false);
    test.equal(types.isFalsy("hello"), false);
    test.equal(types.isFalsy([1]), false);
    test.done();
  }

});
