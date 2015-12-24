"use strict";

var nodeunit = require('nodeunit');
var fate = require('../dist/Fate');
var evaluate = fate.evaluate;

exports.lambda = nodeunit.testCase({
  "Lambdas": function (test) {
    var script1 = 'let a = (x, y) -> x + y\n' +
                  'a(100, 50)';

    var script2 = 'let a = (x, y) -> x + y 42\n' +
                  'a(100, 50)';

    var script3 = 'let a = x -> x * 2\n' +
                  'a(100)';

    test.equal(evaluate(script1), 150);
    test.throws(function () {
      evaluate(script2)
    });
    test.equal(evaluate(script3), 200);
    test.done();
  }
});
