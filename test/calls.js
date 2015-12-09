"use strict";

var nodeunit = require('nodeunit');
var fate = require('../build/fate');
var evaluate = fate.evaluate;

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
    var script1 = 'from string import title\n' +
                  'from array import join\n' +
                  'let formatted = title(join(name))\n' +
                  '{ formatted } | "Hello, %formatted!"';

    test.equal(evaluate(script1, this.data), "Hello, Title Case!");

    test.done();
  },

  "Right Calls": function (test) {
    var script1 = 'from string import title\n' +
                  'from array import join\n' +
                  'let formatted = name | join | title\n' +
                  '{ formatted } | "Hello, %formatted!"';

    var script2 = "['hello', 'there'] | '%1-%0'";

    test.equal(evaluate(script1, this.data), "Hello, Title Case!");
    test.equal(evaluate(script2), "there-hello");

    test.done();
  }
});
