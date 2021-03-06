"use strict";

const nodeunit = require('nodeunit');
const fate = require('../../dist/Fate');
const evaluate = fate.evaluate;

exports.calls = nodeunit.testCase({
  setUp: function (callback) {
    this.data = {
      "name": ["title", "case"],
      "people": [
        { name: 'Bill', age: 19 },
        { name: 'Fred', age: 42 },
        { name: 'Bob', age: 99 }
      ]
    };

    callback();
  },

  "Left Calls": function (test) {
    let script1 = `from string import title
                   from array import join
                   let formatted = title(join(global.name))
                   { formatted } | "Hello, %formatted!"`;

    test.equal(evaluate(script1, this.data), "Hello, Title Case!");

    test.done();
  },

  "Right Calls": function (test) {
    let script1 = `from string import title
                   from array import join
                   let formatted = global.name | join | title
                   { formatted } | "Hello, %formatted!"`;

    let script2 = "['hello', 'there'] | '%1-%0'";

    test.equal(evaluate(script1, this.data), "Hello, Title Case!");
    test.equal(evaluate(script2), "there-hello");

    test.done();
  }
});
