"use strict";

const nodeunit = require('nodeunit');
const fate = require('../../dist/Fate');
const evaluate = fate.evaluate;

exports.strings = nodeunit.testCase({
  "Escape Sequences": function (test) {
    let script1 = '"\\\\ \\" \\\' \\b \\f \\n \\r \\t"';
    let script2 = "'\\\\ \\\" \\' \\b \\f \\n \\r \\t'";
    let script3 = "{name:'hello', age:9} | '%% %name %% %%%% %age'";
    test.equal(evaluate(script1), "\\ \" \' \b \f \n \r \t");
    test.equal(evaluate(script2), "\\ \" \' \b \f \n \r \t");
    test.equal(evaluate(script3), "% hello % %% 9");
    test.done();
  },

  "Multi-Line, Single Quote": function (test) {
    let script1 = "'''hello\nthere'''";
    test.equal(evaluate(script1), "hello\nthere");
    test.done();
  },

  "Functions": function (test) {
    let script1 = `from string import lower
                   lower('CAP STRING')`;
    let script2 = `from string import split
                   split('1\\n2\\n3')[2]`;
    let script3 = `from string import split
                   split('1-2-3', '-')[1]`;
    let script4 = `from string import upper
                   upper('lc string')`;

    let script5 = `from string import build
                   let b=build('%name is %age')
                   { name: 'Thom', age: 43 } | b`;

    test.equal(evaluate(script1), "cap string");
    test.equal(evaluate(script2), "3");
    test.equal(evaluate(script3), "2");
    test.equal(evaluate(script4), "LC STRING");
    test.equal(evaluate(script5), "Thom is 43");

    test.throws(function () {
      evaluate(`
        import string
        string.upper(99)
      `);
    });

    test.throws(function () {
      evaluate(`
        import string
        string.split({obj:'boom'})
      `);
    });

    test.done();
  }

});
