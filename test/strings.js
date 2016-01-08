"use strict";

var nodeunit = require('nodeunit');
var fate = require('../dist/Fate');
var evaluate = fate.evaluate;

exports.strings = nodeunit.testCase({
  "Escape Sequences": function (test) {
    var script1 = '"\\\\ \\" \\\' \\b \\f \\n \\r \\t"';
    var script2 = "'\\\\ \\\" \\' \\b \\f \\n \\r \\t'";
    var script3 = "{name:'hello', age:9} | '%% %name %% %%%% %age'";
    test.equal(evaluate(script1), "\\ \" \' \b \f \n \r \t");
    test.equal(evaluate(script2), "\\ \" \' \b \f \n \r \t");
    test.equal(evaluate(script3), "% hello % %% 9");
    test.done();
  },

  "Multi-Line, Single Quote": function (test) {
    var script1 = "'''hello\nthere'''";
    test.equal(evaluate(script1), "hello\nthere");
    test.done();
  },

  "Functions": function (test) {
    var script1 = "from string import lower\nlower('CAP STRING')";
    var script2 = "from string import split\nsplit('1\\n2\\n3')[2]";
    var script3 = "from string import split\nsplit('1-2-3', '-')[1]";
    var script4 = "from string import upper\nupper('lc string')";
    var script5 = "from string import build\n" +
                  "let b=build('%name is %age')\n" +
                  "{ name: 'Thom', age: 43 } | b";

    test.equal(evaluate(script1), "cap string");
    test.equal(evaluate(script2), "3");
    test.equal(evaluate(script3), "2");
    test.equal(evaluate(script4), "LC STRING");
    test.equal(evaluate(script5), "Thom is 43");

    test.throws(function () {
      evaluate("import string\nstring.upper(99)");
    });

    test.throws(function () {
      evaluate("import string\nstring.split({obj:'boom'})");
    });

    test.done();
  }

});
