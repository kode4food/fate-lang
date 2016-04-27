"use strict";

const nodeunit = require('nodeunit');
const fate = require('../dist/Fate');
const helpers = require('./helpers');
const evaluate = fate.evaluate;
const evaluateEmit = helpers.evaluateEmit;

exports.scope = nodeunit.testCase({
  setUp: function (callback) {
    this.globals = { greeting: "Hello, World!" };

    callback();
  },

  "Shadow Local Scope": function (test) {
    let script1 = "let greeting = 'Not Hello'\n" +
                  "def localGreeting()\n" +
                  "  let greeting = 'Local Hello'\n" +
                  "  return greeting\n" +
                  "end\n" +
                  "localGreeting() + ' ' + greeting";

    let script2 = "let greeting = 'Not Hello'\n" +
                  "def localGreeting()\n" +
                  "  let greeting = 'Local Hello'\n" +
                  "  def evenMoreLocalGreeting()\n" +
                  "    let greeting = 'More Local Hello'\n" +
                  "    return greeting\n" +
                  "  end\n" +
                  "  return evenMoreLocalGreeting() + ' ' + greeting\n" +
                  "end\n" +
                  "localGreeting() + ' ' + greeting";

    test.equal(evaluate(script1, this.globals), "Local Hello Not Hello");
    test.equal(evaluate(script2, this.globals),
               "More Local Hello Local Hello Not Hello");
    test.equal(evaluate("global.greeting", this.globals), "Hello, World!");

    test.throws(function () {
      evaluate("greeting", this.globals);
    });

    test.done();
  },

  "Inherit Local Scope": function (test) {
    let script1 = "let greeting = 'Outer Hello'\n" +
                  "def localGreeting()\n" +
                  "  global.emit(greeting)\n" +
                  "  let greeting = 'Inner Hello'\n" +
                  "  global.emit(greeting)\n" +
                  "end\n" +
                  "localGreeting()\n" +
                  "global.emit(greeting)";

    test.deepEqual(evaluateEmit(script1), ["Outer Hello", "Inner Hello", "Outer Hello"]);
    test.done();
  },

  "Scope Override": function (test) {
    let script = "let b = global.a\n" +
                 "let a = 'child'\n" +
                 "b + ' ' + a";

    test.equal(evaluate(script, { a: 'parent' }), "parent child");
    test.done();
  },

  "Conditional Scope": function (test) {
    let script = "let a=global.a, b=global.b\n" +
                 "let c = a\n" +
                 "if b\n" +
                 "  let a = 'child'\n" +
                 "  let d = a\n" +
                 "end\n" +
                 "c + ' ' + d + ' ' + b + ' ' + a";

    test.equal(evaluate(script, { a: 'parent', b: true }),
               "parent child true child");
    test.done();
  }
});
