"use strict";

const nodeunit = require('nodeunit');
const fate = require('../../dist/Fate');
const evaluate = fate.evaluate;

exports.basics = nodeunit.testCase({
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

  "Entry Point": function (test) {
    test.throws(function() { fate.compile(47); });
    test.equal(evaluate(""), undefined);
    test.done();
  },

  "Relational Evaluation": function (test) {
    test.equal(evaluate("10 * 99 > 900"), true);
    test.equal(evaluate("100 / 5 >= 30"), false);
    test.equal(evaluate("100 / 5 >= 30"), false);
    test.equal(evaluate("99 mod 6 >= 3"), true);
    test.equal(evaluate("33 * 3 mod 6 <= 2"), false);
    test.equal(evaluate("33 * 3 mod 6 <= 2"), false);
    test.equal(evaluate("global.people[0].age * 2 > 99", this.data), true);
    test.equal(evaluate("global.people[0].age / 2 < 24", this.data), false);
    test.equal(evaluate("100 / global.people[0].age >= 2", this.data), true);
    test.equal(evaluate("3 * global.people[0].age <= 149", this.data), false);
    test.done();
  },

  "Equality Evaluation": function (test) {
    test.equal(evaluate("10 * 99 = 990"), true);
    test.equal(evaluate("100 / 5 != 19"), true);
    test.equal(evaluate("99 mod 6 = 3"), true);
    test.equal(evaluate("33 * 3 mod 6 != 2"), true);
    test.equal(evaluate("global.people[0].age * 2 = 99", this.data), false);
    test.equal(evaluate("global.people[0].age / 2 != 25", this.data), false);
    test.equal(evaluate("100 / global.people[0].age = 2", this.data), true);
    test.equal(evaluate("3 * global.people[0].age != 149", this.data), true);
    test.done();
  },

  "In Evaluation": function (test) {
    let data = {
      numbers: [1,10,30],
      names: ['bill', 'ted'],
      person: {age:43, name:'Thom'},
      stringValue: "a name value"
    };
    test.equal(evaluate("10 in [1,10,30]"), true);
    test.equal(evaluate("10 in global.numbers", data), true);
    test.equal(evaluate("'name' in {age:43, name:'Thom'}"), true);
    test.equal(evaluate("'name' in global.person", data), true);
    test.equal(evaluate("'name' in 'a name value'"), false);
    test.equal(evaluate("'name' in global.stringValue", data), false);
    test.equal(evaluate("'fred' in ['bill', 'ted']"), false);
    test.equal(evaluate("'fred' in global.names", data), false);
    test.equal(evaluate("'nothing' in {age:43, name:'Thom'}"), false);
    test.equal(evaluate("'nothing' in global.person", data), false);
    test.done();
  },

  "Not In Evaluation": function (test) {
    let data = {
      numbers: [1,10,30],
      names: ['bill', 'ted'],
      person: {age:43, name:'Thom'},
      stringValue: "a name value"
    };
    test.equal(evaluate("10 not in [1,10,30]"), false);
    test.equal(evaluate("10 not in global.numbers", data), false);
    test.equal(evaluate("'name' not in {age:43, name:'Thom'}"), false);
    test.equal(evaluate("'name' not in global.person", data), false);
    test.equal(evaluate("'name' not in 'a name value'"), true);
    test.equal(evaluate("'name' not in global.stringValue", data), true);
    test.equal(evaluate("'fred' not in ['bill', 'ted']"), true);
    test.equal(evaluate("'fred' not in global.names", data), true);
    test.equal(evaluate("'nothing' not in {age:43, name:'Thom'}"), true);
    test.equal(evaluate("'nothing' not in global.person", data), true);
    test.done();
  },

  "Boolean Or/And Evaluation": function (test) {
    test.equal(evaluate("true and false"), false);
    test.equal(evaluate("true or false"), true);
    test.equal(evaluate("global.people[0].age * 2 = 100 and 'yep'", this.data), "yep");
    test.equal(evaluate("global.people[0].age * 2 = 99 or 'nope'", this.data), "nope");
    test.equal(evaluate("'yep' and global.people[0].age * 2", this.data), 100);
    test.equal(evaluate("'yep' or global.people[0].age * 2", this.data), "yep");
    test.equal(evaluate("false or global.people[0].age * 2", this.data), 100);
    test.equal(evaluate("not true and not false"), false);
    test.equal(evaluate("not(true or false)"), false);
    test.equal(evaluate("not true or not false"), true);
    test.equal(evaluate("not(true and false)"), true);

    test.equal(evaluate(`
      let zero = 0
      zero and 1
    `), true);

    test.equal(evaluate(`
      let zero = 0
      zero and true
    `), true);

    test.equal(evaluate(`
      let zero = 0
      zero and false
    `), false);

    test.done();
  },

  "Unary Evaluation": function (test) {
    test.equal(evaluate("-1"), -1);
    test.equal(evaluate("not false"), true);
    test.equal(evaluate("not true"), false);
    test.equal(evaluate("not (----10 - 10)"), false);
    test.equal(evaluate("-global.people[0].age", this.data), -50);
    test.equal(evaluate("-global.people[0].age + 10", this.data), -40);
    test.equal(evaluate("not (global.people[0].age = 25)", this.data), true);
    test.done();
  },

  "'Nothing' Evaluation": function (test ) {
    let importNothing = "from pattern import Nothing\n";

    test.equal(evaluate(importNothing + "true = Nothing"), false);
    test.equal(evaluate(importNothing + "Nothing != Nothing"), false);
    test.equal(evaluate(importNothing + "Nothing = Nothing"), true);
    test.done();
  },

  "Conditional Evaluation": function (test) {
    let script = "'cond1' if global.cond1 else " +
                 "'cond2' if global.cond2 else " +
                 "'cond4' unless global.cond3 else 'cond3'";

    test.equal(evaluate(script, {cond1: true}), "cond1");
    test.equal(evaluate(script, {cond2: true}), "cond2");
    test.equal(evaluate(script, {cond3: true}), "cond3");
    test.equal(evaluate(script), "cond4");
    test.done();
  },

  "Object Like": function (test) {
    let data = {
      person: {
        name: "Thom",
        age: 42,
        title: "Developer"
      }
    };

    let script1 = 'if global.person like {name: "Thom", age: 42}: true';

    test.equal(evaluate(script1, data), true);
    test.done();
  },

  "Array Like": function (test) {
    let script1 = '[1, 2, 3] like [1, 2]';
    let script2 = '[1, 2, 3] like [1, 2, 3]';
    let script3 = '[1, 2] like [1, 2, 3]';
    let script4 = '[] like []';

    test.equal(evaluate(script1), true);
    test.equal(evaluate(script2), true);
    test.equal(evaluate(script3), false);
    test.equal(evaluate(script4), true);
    test.done();
  },

  "Deep Paths": function (test) {
    let data = {
      root: [{
        colors: ['red', 'green', 'blue'],
        info: {
          description: "this is a description"
        }
      }]
    };

    test.equal(evaluate("global.root[0].colors[1]", data), "green");
    test.equal(evaluate("global.root[0].info.description", data), "this is a description");
    test.equal(evaluate("global.root[0].info['description']", data), "this is a description");
    test.equal(evaluate("global.root[0].info.notThere", data), undefined);
    test.throws(function () {
      test.equal(evaluate("global.root[1].info['description']", data));
    });
    test.done();
  },

  "Assignments": function (test) {
    test.equal(evaluate(`
      let a = 99
      a
    `), 99);

    test.equal(evaluate(`
      let a = 99, b = 1000
      a + b
    `), 1099);

    test.equal(evaluate(`
      let a = 100, b = a + 20, c = b * 2
      c
    `), 240);

    test.done();
  },

  "Context": function (test) {
    let person = { name: 'thom', age: 43, colors: ['red', 'green', 'blue'] };
    test.equal(evaluate("global.name", person), 'thom');
    test.deepEqual(evaluate("global.colors", person), person.colors);
    test.equal(evaluate("global.age", person), 43);
    test.done();
  }
});
