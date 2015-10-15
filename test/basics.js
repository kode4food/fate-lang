"use strict";

var nodeunit = require('nodeunit');
var fate = require('../build/fate');
var evaluate = fate.evaluate;

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
    test.done();
  },

  "Relational Evaluation": function (test) {
    test.equal(evaluate("10 * 99 > 900"), true);
    test.equal(evaluate("100 / 5 >= 30"), false);
    test.equal(evaluate("100 / 5 >= 30"), false);
    test.equal(evaluate("99 mod 6 >= 3"), true);
    test.equal(evaluate("33 * 3 mod 6 <= 2"), false);
    test.equal(evaluate("33 * 3 mod 6 <= 2"), false);
    test.equal(evaluate("people[0].age * 2 > 99", this.data), true);
    test.equal(evaluate("people[0].age / 2 < 24", this.data), false);
    test.equal(evaluate("100 / people[0].age >= 2", this.data), true);
    test.equal(evaluate("3 * people[0].age <= 149", this.data), false);
    test.done();
  },

  "Equality Evaluation": function (test) {
    test.equal(evaluate("10 * 99 = 990"), true);
    test.equal(evaluate("100 / 5 != 19"), true);
    test.equal(evaluate("99 mod 6 = 3"), true);
    test.equal(evaluate("33 * 3 mod 6 != 2"), true);
    test.equal(evaluate("people[0].age * 2 = 99", this.data), false);
    test.equal(evaluate("people[0].age / 2 != 25", this.data), false);
    test.equal(evaluate("100 / people[0].age = 2", this.data), true);
    test.equal(evaluate("3 * people[0].age != 149", this.data), true);
    test.done();
  },

  "In Evaluation": function (test) {
    var data = {
      numbers: [1,10,30],
      names: ['bill', 'ted'],
      person: {age:43, name:'Thom'},
      stringValue: "a name value"
    };
    test.equal(evaluate("10 in [1,10,30]"), true);
    test.equal(evaluate("10 in numbers", data), true);
    test.equal(evaluate("'name' in {age:43, name:'Thom'}"), true);
    test.equal(evaluate("'name' in person", data), true);
    test.equal(evaluate("'name' in 'a name value'"), false);
    test.equal(evaluate("'name' in stringValue", data), false);
    test.equal(evaluate("'fred' in ['bill', 'ted']"), false);
    test.equal(evaluate("'fred' in names", data), false);
    test.equal(evaluate("'nothing' in {age:43, name:'Thom'}"), false);
    test.equal(evaluate("'nothing' in person", data), false);
    test.done();
  },

  "Not In Evaluation": function (test) {
    var data = {
      numbers: [1,10,30],
      names: ['bill', 'ted'],
      person: {age:43, name:'Thom'}
    };
    test.equal(evaluate("10 not in [1,10,30]"), false);
    test.equal(evaluate("10 not in numbers", data), false);
    test.equal(evaluate("'name' not in {age:43, name:'Thom'}"), false);
    test.equal(evaluate("'name' not in person", data), false);
    test.equal(evaluate("'name' not in 'a name value'"), true);
    test.equal(evaluate("'name' not in stringValue", data), true);
    test.equal(evaluate("'fred' not in ['bill', 'ted']"), true);
    test.equal(evaluate("'fred' not in names", data), true);
    test.equal(evaluate("'nothing' not in {age:43, name:'Thom'}"), true);
    test.equal(evaluate("'nothing' not in person", data), true);
    test.done();
  },

  "Boolean Or/And Evaluation": function (test) {
    test.equal(evaluate("true and false"), false);
    test.equal(evaluate("true or false"), true);
    test.equal(evaluate("people[0].age * 2 = 100 and 'yep'", this.data), "yep");
    test.equal(evaluate("people[0].age * 2 = 99 or 'nope'", this.data), "nope");
    test.equal(evaluate("'yep' and people[0].age * 2", this.data), 100);
    test.equal(evaluate("'yep' or people[0].age * 2", this.data), "yep");
    test.equal(evaluate("false or people[0].age * 2", this.data), 100);
    test.equal(evaluate("not true and not false"), false);
    test.equal(evaluate("not(true or false)"), false);
    test.equal(evaluate("not true or not false"), true);
    test.equal(evaluate("not(true and false)"), true);
    test.done();
  },

  "Unary Evaluation": function (test) {
    test.equal(evaluate("-1"), -1);
    test.equal(evaluate("not false"), true);
    test.equal(evaluate("not true"), false);
    test.equal(evaluate("not (----10 - 10)"), true);
    test.equal(evaluate("-people[0].age", this.data), -50);
    test.equal(evaluate("-people[0].age + 10", this.data), -40);
    test.equal(evaluate("not (people[0].age = 25)", this.data), true);
    test.done();
  },

  "Nil Evaluation": function (test ) {
    test.equal(evaluate("true = nil"), false);
    test.equal(evaluate("nil != nil"), false);
    test.equal(evaluate("nil = nil"), true);
    test.equal(evaluate("bogusValue != nil"), false);
    test.equal(evaluate("bogusValue = nil"), true);
    test.done();
  },

  "Conditional Evaluation": function (test) {
    var script = "'cond1' if cond1 else " +
                 "'cond2' if cond2 else " +
                 "'cond4' unless cond3 else 'cond3'";

    test.equal(evaluate(script, {cond1: true}), "cond1");
    test.equal(evaluate(script, {cond2: true}), "cond2");
    test.equal(evaluate(script, {cond3: true}), "cond3");
    test.equal(evaluate(script), "cond4");
    test.done();
  },

  "Object Like": function (test) {
    var data = {
      person: {
        name: "Thom",
        age: 42,
        title: "Developer"
      }
    };

    var script1 = 'if person like {name: "Thom", age: 42}\n' +
                  '  true\n' +
                  'end';

    test.equal(evaluate(script1, data), true);
    test.done();
  },

  "Vector Like": function (test) {
    var script1 = '[1, 2, 3] like [1, 2]';
    var script2 = '[1, 2, 3] like [1, 2, 3]';
    var script3 = '[1, 2] like [1, 2, 3]';
    var script4 = '[] like []';

    test.equal(evaluate(script1), true);
    test.equal(evaluate(script2), true);
    test.equal(evaluate(script3), false);
    test.equal(evaluate(script4), true);
    test.done();
  },

  "Deep Paths": function (test) {
    var data = {
      root: [{
        colors: ['red', 'green', 'blue'],
        info: {
          description: "this is a description"
        }
      }]
    };

    test.equal(evaluate("root[0].colors[1]", data), "green");
    test.equal(evaluate("root[0].info.description", data), "this is a description");
    test.equal(evaluate("root[0].info['description']", data), "this is a description");
    test.equal(evaluate("root[0].info.notThere", data), undefined);
    test.throws(function () {
      test.equal(evaluate("root[1].info['description']", data));
    });
    test.done();
  },

  "Assignments": function (test) {
    test.equal(evaluate("let a = 99\na"), 99);
    test.equal(evaluate("let a = 99, b = 1000\na + b"), 1099);
    test.equal(evaluate("let a = 100, b = a + 20, c = b * 2\nc"), 240);
    test.done();
  },

  "Self": function (test) {
    var person = { name: 'thom', age: 43, colors: ['red', 'green', 'blue'] };
    test.equal(evaluate("self.name", person), 'thom');
    test.equal(evaluate("self.colors", person), person.colors);
    test.equal(evaluate("self['age']", person), 43);
    test.equal(evaluate("self", person), person);
    test.done();
  }
});
