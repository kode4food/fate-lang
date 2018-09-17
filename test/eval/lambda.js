/** @flow */

const nodeunit = require('nodeunit');
const fate = require('../../dist/fate');

const evaluate = fate.evaluate;

exports.lambda = nodeunit.testCase({
  Lambdas(test) {
    const script1 = `let a = (x, y -> x + y)
                   a(100, 50)`;

    const script2 = `let a = (x, y → x + y 42)
                   a(100, 50)`;

    const script3 = `let a = (x → x • 2)
                   a(100)`;

    test.equal(evaluate(script1), 150);
    test.throws(() => {
      evaluate(script2);
    });
    test.equal(evaluate(script3), 200);
    test.done();
  },
});
