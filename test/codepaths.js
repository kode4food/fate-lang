"use strict";

const nodeunit = require('nodeunit');
const fate = require('../dist/Fate');
const evaluate = fate.evaluate;

exports.codepaths = nodeunit.testCase({
  setUp: function (callback) {
    this.data = {
      low_number: 12,
      high_number: 20,
      true_val: true,
      false_val: false,
      null_value: null,
      undefined_value: undefined,
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
    test.equal(evaluate("true_val if not false_val else false_val", this.data), true);

    test.equal(evaluate("true if false else false", this.data), false);
    test.equal(evaluate("true if false_val else false", this.data), false);
    test.equal(evaluate("true if false else false_val", this.data), false);
    test.equal(evaluate("true if false_val else false_val", this.data), false);
    test.equal(evaluate("true_val if false else false", this.data), false);
    test.equal(evaluate("true_val if false_val else false", this.data), false);
    test.equal(evaluate("true_val if false else false_val", this.data), false);
    test.equal(evaluate("true_val if false_val else false_val", this.data), false);
    test.equal(evaluate("true_val if not true_val else false_val", this.data), false);

    test.done();
  },

  "'if' with literals": function (test) {
    let script1 = "if true\n'was true'\nelse\n'was false'\nend";
    let script2 = "if false\n'was true'\nelse\n'was false'\nend";
    let script3 = "if true\n'was true'\nend";
    let script4 = "if false\n'was true'\nend";

    test.equal(evaluate(script1), 'was true');
    test.equal(evaluate(script2), 'was false');
    test.equal(evaluate(script3), 'was true');
    test.equal(evaluate(script4), undefined);

    test.done();
  },

  "'self' outside Function": function (test) {
    test.throws(function () {
      evaluate("self('hello')");
    }, "self called outside of a Function should explode");
    test.done();
  },

  "'await' expressions": function (test) {
    test.ok(evaluate("do\nawait x\nend"));

    test.throws(function () {
      evaluate("await x");
    }, "await called outside of a 'do' block should explode");

    test.throws(function () {
      evaluate("import io\ndo\n-> await io.timeout(100)\nend");
    }, "await called nested in func should explode");

    test.done();
  },

  "Wildcard outside Binding": function (test) {
    test.throws(function () {
      evaluate("? < 99");
    }, "Wildcard used outside of a binding");
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
    test.throws(() => {
      evaluate("null_value[null_value]", this.data);
    });

    test.equal(evaluate("obj_value.name", this.data), "Thom");
    test.equal(evaluate("obj_value['name']", this.data), "Thom");
    test.equal(evaluate("obj_value[name_key]", this.data), "Thom");
    test.equal(evaluate("obj_value.missing", this.data), undefined);
    test.equal(evaluate("obj_value[missing_key]", this.data), undefined);

    test.done();
  },

  "Truthy": function (test) {
    test.equal(evaluate("if [1,2,3]\ntrue\nend"), true);
    test.equal(evaluate("if []\ntrue\nend"), true);
    test.done();
  },

  "Rewrite": function (test) {
    let script1 = "let a = 'hello'\n" +
                  "let b = 'goodbye'\n" +
                  "a + b";

    let script2 = "let a = 5\n" +
                  "if not (a like 10)\n" +
                  "  'hello!'\n" +
                  "end";

    let script3 = "if not (a like 10) and not (b like 8)\n" +
                  "  'yes'\n" +
                  "else\n" +
                  "  'no'\n" +
                  "end";

    let script4 = "if not (a like 10) or not (b like 8)\n" +
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
  },

  "Formatting": function (test) {
    let script1 = "'World' | 'Hello, %0!'";
    let script2 = "'World' | 'Hello, %!'";

    test.equal(evaluate(script1), "Hello, World!");
    test.equal(evaluate(script2), "Hello, World!");

    test.done();
  },

  "Keywords": function (test) {
    let script = "{self: 'isSelf', for: 'isFor', where: 'isWhere'}";

    test.equal(evaluate(script + ".self"), "isSelf");
    test.equal(evaluate(script + ".for"), "isFor");
    test.equal(evaluate(script + ".where"), "isWhere");

    test.throws(function () {
      evaluate("let for = 'hello'");
    }, "Keyword used as an identifier");

    test.done();
  },

  "Parameter Ordering": function (test) {
    test.throws(function () {
      evaluate("def test(a*, b)\nb\nend");
    }, "Parameters are out of order");

    test.throws(function () {
      evaluate("def test(b*, c*, d*)\nb\nend");
    }, "Parameters are out of order");

    test.done();
  }
});
