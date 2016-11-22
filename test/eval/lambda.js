"use strict";

const nodeunit = require('nodeunit');
const fate = require('../../dist/Fate');
const evaluate = fate.evaluate;

exports.lambda = nodeunit.testCase({
  "Lambdas": function (test) {
    let script1 = `let a = (x, y -> x + y)
                   a(100, 50)`;

    let script2 = `let a = (x, y → x + y 42)
                   a(100, 50)`;

    let script3 = `let a = (x → x • 2)
                   a(100)`;

    test.equal(evaluate(script1), 150);
    test.throws(function () {
      evaluate(script2)
    });
    test.equal(evaluate(script3), 200);
    test.done();
  }
});
