"use strict";

var nodeunit = require('nodeunit');
var fate = require('../build/fate');
var evaluate = fate.evaluate;

exports.codepaths = nodeunit.testCase({
  setUp: function (callback) {
    this.data = {
      low_number: 12,
      high_number: 20,
      true_val: true,
      false_val: false,
      nil_value: null,
      obj_value: {
        name: 'Thom',
        age: 42
      },
      name_key: "name",
      missing_key: "missing"
    };

    callback();
  },

  "No Literals": function (test) {
    test.equal(evaluate("low_number < high_number", this.data), true);
    test.equal(evaluate("low_number <= high_number", this.data), true);
    test.equal(evaluate("high_number > low_number", this.data), true);
    test.equal(evaluate("high_number >= low_number", this.data), true);
    test.equal(evaluate("low_number = low_number", this.data), true);
    test.equal(evaluate("high_number != low_number", this.data), true);
    test.equal(evaluate("low_number + high_number", this.data), 32);
    test.equal(evaluate("high_number - low_number", this.data), 8);
    test.equal(evaluate("high_number * low_number", this.data), 240);
    test.equal(evaluate("high_number / low_number", this.data), 1.6666666666666667);
    test.equal(evaluate("high_number like high_number", this.data), true);
    test.equal(evaluate("high_number mod low_number", this.data), 8);
    test.equal(evaluate("true_val and true_val", this.data), true);
    test.equal(evaluate("false_val and true_val", this.data), false);
    test.equal(evaluate("false_val or true_val", this.data), true);
    test.equal(evaluate("true_val or false_val", this.data), true);
    test.done();
  },

  "Left Literal": function (test) {
    test.equal(evaluate("12 < high_number", this.data), true);
    test.equal(evaluate("12 <= high_number", this.data), true);
    test.equal(evaluate("20 > low_number", this.data), true);
    test.equal(evaluate("20 >= low_number", this.data), true);
    test.equal(evaluate("12 = low_number", this.data), true);
    test.equal(evaluate("20 != low_number", this.data), true);
    test.equal(evaluate("12 + high_number", this.data), 32);
    test.equal(evaluate("20 - low_number", this.data), 8);
    test.equal(evaluate("20 * low_number", this.data), 240);
    test.equal(evaluate("20 / low_number", this.data), 1.6666666666666667);
    test.equal(evaluate("20 like high_number", this.data), true);
    test.equal(evaluate("20 mod low_number", this.data), 8);
    test.equal(evaluate("true and true_val", this.data), true);
    test.equal(evaluate("false and true_val", this.data), false);
    test.equal(evaluate("false or true_val", this.data), true);
    test.equal(evaluate("true or false_val", this.data), true);
    test.done();
  },

  "Right Literal": function (test) {
    test.equal(evaluate("low_number < 20", this.data), true);
    test.equal(evaluate("low_number <= 20", this.data), true);
    test.equal(evaluate("high_number > 12", this.data), true);
    test.equal(evaluate("high_number >= 12", this.data), true);
    test.equal(evaluate("low_number = 12", this.data), true);
    test.equal(evaluate("high_number != 12", this.data), true);
    test.equal(evaluate("low_number + 20", this.data), 32);
    test.equal(evaluate("high_number - 12", this.data), 8);
    test.equal(evaluate("high_number * 12", this.data), 240);
    test.equal(evaluate("high_number / 12", this.data), 1.6666666666666667);
    test.equal(evaluate("high_number like 20", this.data), true);
    test.equal(evaluate("high_number mod 12", this.data), 8);
    test.equal(evaluate("true_val and true", this.data), true);
    test.equal(evaluate("false_val and true", this.data), false);
    test.equal(evaluate("false_val or true", this.data), true);
    test.equal(evaluate("true_val or false", this.data), true);
    test.done();
  },

  "Both Literals": function (test) {
    test.equal(evaluate("12 < 20", this.data), true);
    test.equal(evaluate("12 <= 20", this.data), true);
    test.equal(evaluate("20 > 12", this.data), true);
    test.equal(evaluate("20 >= low_number", this.data), true);
    test.equal(evaluate("12 = 12", this.data), true);
    test.equal(evaluate("20 != 12", this.data), true);
    test.equal(evaluate("12 + 20", this.data), 32);
    test.equal(evaluate("20 - 12", this.data), 8);
    test.equal(evaluate("20 * 12", this.data), 240);
    test.equal(evaluate("20 / 12", this.data), 1.6666666666666667);
    test.equal(evaluate("20 like 20", this.data), true);
    test.equal(evaluate("20 mod 12", this.data), 8);
    test.equal(evaluate("true and true", this.data), true);
    test.equal(evaluate("false and true", this.data), false);
    test.equal(evaluate("false or true", this.data), true);
    test.equal(evaluate("true or false", this.data), true);
    test.done();
  },

  "Conditional": function (test) {
    test.equal(evaluate("true if true else false", this.data), true);
    test.equal(evaluate("true if true_val else false", this.data), true);
    test.equal(evaluate("true if true else false_val", this.data), true);
    test.equal(evaluate("true if true_val else false_val", this.data), true);
    test.equal(evaluate("true_val if true else false", this.data), true);
    test.equal(evaluate("true_val if true_val else false", this.data), true);
    test.equal(evaluate("true_val if true else false_val", this.data), true);
    test.equal(evaluate("true_val if true_val else false_val", this.data), true);

    test.equal(evaluate("true if false else false", this.data), false);
    test.equal(evaluate("true if false_val else false", this.data), false);
    test.equal(evaluate("true if false else false_val", this.data), false);
    test.equal(evaluate("true if false_val else false_val", this.data), false);
    test.equal(evaluate("true_val if false else false", this.data), false);
    test.equal(evaluate("true_val if false_val else false", this.data), false);
    test.equal(evaluate("true_val if false else false_val", this.data), false);
    test.equal(evaluate("true_val if false_val else false_val", this.data), false);

    test.done();
  },

  "Duplicated Arg Names": function (test) {
    test.throws(function () {
      evaluate("def someFunction(arg1, arg2, arg1, arg3, arg2)\nend");
    }, "Duplicated arg names in a Function should explode");

    test.throws(function () {
      evaluate("when a(arg1, arg2) & b(arg3, arg2)\nend");
    }, "Arg names duplicated across channels should explode");
    
    test.done();
  },

  "Membership": function (test) {
    test.throws(function () {
      evaluate("nil.missing");
    });

    test.throws(function () {
      evaluate("nil_value[nil_value]", this.data);
    });

    test.throws(function () {
      evaluate("nil[nil_value]", this.data);
    });

    test.equal(evaluate("obj_value.name", this.data), "Thom");
    test.equal(evaluate("obj_value['name']", this.data), "Thom");
    test.equal(evaluate("obj_value[name_key]", this.data), "Thom");
    test.equal(evaluate("obj_value.missing", this.data), undefined);
    test.equal(evaluate("obj_value[missing_key]", this.data), undefined);

    test.throws(function () {
      evaluate("nil_value.missing", this.data);
    });

    test.done();
  },

  "Truthy": function (test) {
    test.equal(evaluate("if [1,2,3]\ntrue\nend"), true);
    test.equal(evaluate("unless []\ntrue\nend"), true);
    test.done();
  },

  "Rewrite": function (test) {
    var script1 = "let a = 'hello'\n" +
                  "let b = 'goodbye'\n" +
                  "a + b";

    var script2 = "let a = 5\n" +
                  "if not (a like 10)\n" +
                  "  'hello!'\n" +
                  "end";

    var script3 = "if not (a like 10) and not (b like 8)\n" +
                  "  'yes'\n" +
                  "else\n" +
                  "  'no'\n" +
                  "end";

    var script4 = "if not (a like 10) or not (b like 8)\n" +
                  "  'yes'\n" +
                  "else\n" +
                  "  'no'\n" +
                  "end";

    test.equal(evaluate(script1), "hellogoodbye");
    test.equal(evaluate(script2), "hello!");
    test.equal(evaluate(script3, { a: 5, b: 4 }), "yes");
    test.equal(evaluate(script3, { a: 10, b: 4 }), "no");
    test.equal(evaluate(script4, { a: 10, b: 8 }), "no");
    test.equal(evaluate(script4, { a: 5, b: 8 }), "yes");

    test.done();
  }
});
