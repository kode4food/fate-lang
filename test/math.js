"use strict";

var nodeunit = require('nodeunit');
var fate = require('../dist/Fate');
var evaluate = fate.evaluate;

exports.math = nodeunit.testCase({
  setUp: function (callback) {
    this.data = {
      "name": "World",
      "title": "Famous People",
      "people" : [
        { "name": "Larry", "age": 50, "brothers": [] },
        { "name": "Curly", "age": 45, "brothers": ["Moe", "Shemp"]},
        { "name": "Moe", "age": 58, "brothers": ["Curly", "Shemp"]}
      ]
    };

    callback();
  },

  "Numbers": function (test) {
    test.equal(evaluate("1.2E5"), 120000);
    test.equal(evaluate("1.2e+10"), 12000000000);
    test.equal(evaluate("1.5e-5"), 0.000015);
    test.equal(evaluate("-1.8e-2"), -0.018);
    test.done();
  },

  "Arithmetic Evaluation": function (test) {
    test.equal(evaluate("1 + 1"), 2);
    test.equal(evaluate("10 - 7"), 3);
    test.equal(evaluate("10 + 30 - 5"), 35);
    test.equal(evaluate("people[0].age + 10", this.data), 60);
    test.equal(evaluate("60 - people[0].age", this.data), 10);
    test.done();
  },

  "Multiplicative Evaluation": function (test) {
    test.equal(evaluate("10 * 99"), 990);
    test.equal(evaluate("100 / 5"), 20);
    test.equal(evaluate("99 mod 6"), 3);
    test.equal(evaluate("33 * 3 mod 6"), 3);
    test.equal(evaluate("people[0].age * 2", this.data), 100);
    test.equal(evaluate("people[0].age / 2", this.data), 25);
    test.equal(evaluate("100 / people[0].age", this.data), 2);
    test.equal(evaluate("3 * people[0].age", this.data), 150);
    test.equal(evaluate("(33 * 6 - (people[0].age + 1)) mod 6", this.data), 3);
    test.done();
  },

  "Functions": function (test) {
    test.equal(evaluate("import math\nmath.avg([1,2,3])"), 2);

    test.throws(() => {
      evaluate("import math\nmath.avg([])")
    });

    test.throws(() => {
      evaluate("import math\nmath.avg(['non_num'])");
    });

    test.throws(() => {
      evaluate("import math\nmath.avg('non_num')");
    });

    test.throws(() => {
      evaluate("import math\nmath.avg(1)");
    });

    test.equal(evaluate("import math\nmath.sum([1,2,3])"), 6);

    test.throws(() => {
      evaluate("import math\nmath.sum(5)");
    });

    test.throws(() => {
      evaluate("import math\nmath.sum('non_num')");
    });

    test.equal(evaluate("import math\nmath.max([1,9,7])"), 9);

    test.throws(() => {
      evaluate("import math\nmath.max(7)");
    });

    test.throws(() => {
      evaluate("import math\nmath.max('non_num')");
    });

    test.equal(evaluate("import math\nmath.median([1,9,7,50])"), 8);
    test.equal(evaluate("import math\nmath.median([1,9,7,50,6])"), 7);
    test.equal(evaluate("import math\nmath.median([9,1])"), 5);
    test.equal(evaluate("import math\nmath.median([9])"), 9);

    test.throws(() => {
      evaluate("import math\nmath.median(7)");
    });

    test.throws(() => {
      evaluate("import math\nmath.median([])");
    });

    test.throws(() => {
      evaluate("import math\nmath.median('non_num')");
    });

    test.equal(evaluate("import math\nmath.min([1,9,7])"), 1);

    test.throws(() => {
      evaluate("import math\nmath.min(5)");
    });

    test.throws(() => {
      evaluate("import math\nmath.min('non_num')");
    });

    test.done();
  }
});
