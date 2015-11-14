"use strict";

var nodeunit = require('nodeunit');
var fate = require('../build/fate');
var evaluate = fate.evaluate;

exports.like = nodeunit.testCase({
  "Guard Patterns": function (test) {
    var script1 = "let p = ~{ name: ? != 'Thom', age: ? != 43 }\n" +
                  "def func(person)\n" +
                  "  'normal person: ' + person.name\n" +
                  "end\n" +
                  "def func(p as person)\n" +
                  "  'non-Thom person: ' + person.name\n" +
                  "end\n" +
                  "func({ name: 'Bill', age: 42 })";

    test.equal(evaluate(script1), "non-Thom person: Bill");
    test.done();
  },

  "Object Patterns": function (test) {
    var script1 = "let p = ~{ name: ? != 'Thom', age: ? != 43 }\n" +
                  "{ name: 'Bill', age: 27 } like p";

    var script2 = "let p = ~[?, { name: 'Thom', age: ? > 20 }, 99]\n" +
                  "['crap', { name: 'Thom', age: 30 }, 99] like p";

    var script3 = "let p = ~{ name: ? != 'Thom', age: ? != 43 }\n" +
                  "{ name: 'Thom', age: 27 } like p";

    var script4 = "let p = ~{name: 'Thom', address: ~{ city: 'Boston' }}\n" +
                  "{name: 'Thom', address: { street: '123 Main', city: 'Boston' }} like p";

    test.equal(evaluate(script1), true);
    test.equal(evaluate(script2), true);
    test.equal(evaluate(script3), false);
    test.equal(evaluate(script4), true);
    test.done();
  },

  "Array Patterns": function (test) {
    var script1 = "let p = ~(? > 50 and ? < 100)\n" +
                  "p(75)";

    var script2 = "let p = ~(? > 50 and ? < 100)\n" +
                  "75 like p";

    var script3 = "let p = ~[12, ?, 99]\n" +
                  "[12, 88, 99] like p";

    var script4 = "let p = ~([12, ?, 99] and ?[1]=88)\n" +
                  "[12, 88, 99] like p";

    var script5 = "let p = ~[12, [1, ?, 3]]\n" +
                  "[12, [1, 5, 3], 24] like p";

    test.equal(evaluate(script1), true);
    test.equal(evaluate(script2), true);
    test.equal(evaluate(script3), true);
    test.equal(evaluate(script4), true);
    test.equal(evaluate(script5), true);
    test.done();
  },

  "Invalid Wildcards": function (test) {
    test.throws(function () {
      evaluate("? > 99");
    }, "Invalid top level wildcard");

    test.throws(function () {
      evaluate("~{ ?: 'hello' }");
    }, "Invalid object id wildcard");

    test.done();
  },

  "Like Matching": function (test) {
    var person1 = {
      "name": "Thom",
      "age": 42,
      "job": "Developer",
      "colors": ["red", "green", "blue"]
    };

    var person2 = {
      "name": "Thom",
      "age": 42,
      "colors": ["red", "green", "blue"]
    };

    var person3 = {
      "name": "Thom",
      "age": 42,
      "colors": ["red", "green", "yellow"]
    };

    var person4 = {
      "name": "Thom",
      "colors": ["red", "blue"]
    };

    var array = ["red", "green", "blue"];

    var data = {
      person1: person1,
      person2: person2,
      person3: person3,
      person4: person4,
      array: array,
      null_value: null
    };

    var script1 = 'if person1 like person2\n' +
                  '  "They match!"\n' +
                  'end';

    var script2 = 'unless person1 like person3\n' +
                  '  "They don\'t match!"\n' +
                  'end';

    var script3 = 'unless person1 like person4\n' +
                  '  "They don\'t match!"\n' +
                  'end';

    var script4 = 'if array like ["red", "green", "blue"]\n' +
                  '  "They match!"\n' +
                  'else\n' +
                  '  "They don\'t match!"\n' +
                  'end';

    var script5 = 'unless person1 like {name: "Thom", age: 56}\n' +
                  '  "They don\'t match!"\n' +
                  'end';

    test.equal(evaluate(script1, data), "They match!");
    test.equal(evaluate(script1, { person1: null }), "They match!");
    test.equal(evaluate(script2, data), "They don't match!");
    test.equal(evaluate(script3,
              { person1: person1, person3: 88 }),
              "They don't match!");
    test.equal(evaluate(script3, data), "They don't match!");
    test.equal(evaluate(script4, data), "They match!");
    test.equal(evaluate(script4, { array: [] }), "They don't match!");
    test.equal(evaluate(script4, { array: ['blue', 'white', 'green'] }),
              "They don't match!");
    test.equal(evaluate(script5, data), "They don't match!");
    test.equal(evaluate(script5, { person1: null }), "They don't match!");

    test.equal(evaluate("nil like null_value", data), true);
    test.equal(evaluate("null_value like nil", data), true);

    test.done();
  }
});
