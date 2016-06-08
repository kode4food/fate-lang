"use strict";

const nodeunit = require('nodeunit');
const fate = require('../dist/Fate');
const evaluate = fate.evaluate;

exports.like = nodeunit.testCase({
  "Guard Patterns": function (test) {
    let script1 = "let p = ~{ name: it != 'Thom', age: it != 43 }\n" +
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
    let script1 = "let p = ~{ name: it != 'Thom', age: it != 43 }\n" +
                  "{ name: 'Bill', age: 27 } like p";

    let script2 = "let p = ~[?, { name: 'Thom', age: it > 20 }, 99]\n" +
                  "['crap', { name: 'Thom', age: 30 }, 99] like p";

    let script3 = "let p = ~{ name: it != 'Thom', age: it != 43 }\n" +
                  "{ name: 'Thom', age: 27 } like p";

    let script4 = "let p = ~{name: 'Thom', address: ~{ city: 'Boston' }}\n" +
                  "{name: 'Thom', address: { street: '123 Main', city: 'Boston' }} like p";

    test.equal(evaluate(script1), true);
    test.equal(evaluate(script2), true);
    test.equal(evaluate(script3), false);
    test.equal(evaluate(script4), true);
    test.done();
  },

  "Array Patterns": function (test) {
    let script1 = "let p = ~(it > 50 and it < 100)\n" +
                  "p(75)";

    let script2 = "let p = ~(it > 50 and it < 100)\n" +
                  "75 like p";

    let script3 = "let p = ~[12, ?, 99]\n" +
                  "[12, 88, 99] like p";

    let script4 = "let p = ~(it like ~[12, ?, 99] and it[1]=88)\n" +
                  "[12, 88, 99] like p";

    let script5 = "let p = ~[12, [1, ?, 3]]\n" +
                  "[12, [1, 5, 3], 24] like p";

    let script6 = "'hello' like ~(it)";

    test.equal(evaluate(script1), true);
    test.equal(evaluate(script2), true);
    test.equal(evaluate(script3), true);
    test.equal(evaluate(script4), true);
    test.equal(evaluate(script5), true);
    test.equal(evaluate(script6), true);
    test.done();
  },

  "Like Matching": function (test) {
    let person1 = {
      "name": "Thom",
      "age": 42,
      "job": "Developer",
      "colors": ["red", "green", "blue"]
    };

    let person2 = {
      "name": "Thom",
      "age": 42,
      "colors": ["red", "green", "blue"]
    };

    let person3 = {
      "name": "Thom",
      "age": 42,
      "colors": ["red", "green", "yellow"]
    };

    let person4 = {
      "name": "Thom",
      "colors": ["red", "blue"]
    };

    let array = ["red", "green", "blue"];

    let data = {
      person1: person1,
      person2: person2,
      person3: person3,
      person4: person4,
      array: array,
      null_value: null
    };

    let script1 = 'if global.person1 like global.person2\n' +
                  '  "They match!"\n' +
                  'end';

    let script2 = 'unless global.person1 like global.person3\n' +
                  '  "They don\'t match!"\n' +
                  'end';

    let script3 = 'unless global.person1 like global.person4\n' +
                  '  "They don\'t match!"\n' +
                  'end';

    let script4 = 'if global.array like ["red", "green", "blue"]\n' +
                  '  "They match!"\n' +
                  'else\n' +
                  '  "They don\'t match!"\n' +
                  'end';

    let script5 = 'unless global.person1 like {name: "Thom", age: 56}\n' +
                  '  "They don\'t match!"\n' +
                  'end';

    let script6 = "import pattern\n" +
                  "pattern.Nothing like global.null_value";

    let script7 = "import pattern\n" +
                  "global.null_value like pattern.Nothing";

    test.equal(evaluate(script1, data), "They match!");
    test.equal(evaluate(script1, { person1: null }), "They match!");
    test.equal(evaluate(script2, data), "They don't match!");
    test.equal(evaluate(script3, { person1: person1, person3: 88 }),
               "They don't match!");
    test.equal(evaluate(script3, data), "They don't match!");
    test.equal(evaluate(script4, data), "They match!");
    test.equal(evaluate(script4, { array: [] }), "They don't match!");
    test.equal(evaluate(script4, { array: ['blue', 'white', 'green'] }),
               "They don't match!");
    test.equal(evaluate(script5, data), "They don't match!");
    test.equal(evaluate(script5, { person1: null }), "They don't match!");

    test.equal(evaluate(script6, data), true);
    test.equal(evaluate(script7, data), true);
    test.equal(evaluate("global.person1 like global.person1", data), true);

    test.done();
  }
});
