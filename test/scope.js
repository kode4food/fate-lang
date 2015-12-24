"use strict";

var nodeunit = require('nodeunit');
var fate = require('../dist/Fate');
var helpers = require('./helpers');
var evaluate = fate.evaluate;
var evaluateEmit = helpers.evaluateEmit;

exports.scope = nodeunit.testCase({
  setUp: function (callback) {
    this.globals = { greeting: "Hello, World!" };

    callback();
  },

  "Shadow Local Scope": function (test) {
    var script1 = "let greeting = 'Not Hello'\n" +
                  "def localGreeting()\n" +
                  "  let greeting = 'Local Hello'\n" +
                  "  return greeting\n" +
                  "end\n" +
                  "localGreeting() + ' ' + greeting";

    var script2 = "let greeting = 'Not Hello'\n" +
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
    test.equal(evaluate("greeting", this.globals), "Hello, World!");
    test.done();
  },

  "Inherit Local Scope": function (test) {
    var script1 = "let greeting = 'Outer Hello'\n" +
                  "def localGreeting()\n" +
                  "  emit(greeting)\n" +
                  "  let greeting = 'Inner Hello'\n" +
                  "  emit(greeting)\n" +
                  "end\n" +
                  "localGreeting()\n" +
                  "emit(greeting)";

    test.deepEqual(evaluateEmit(script1), ["Outer Hello", "Inner Hello", "Outer Hello"]);
    test.done();
  },

  "Shadow Global Scope": function (test) {
    test.equal(evaluate("let greeting='Not Hello!'\ngreeting", this.globals), "Not Hello!");
    test.equal(evaluate("greeting", this.globals), "Hello, World!");
    test.done();
  },

  "Scope Override": function (test) {
    var script = "let b = a\n" +
                 "let a = 'child'\n" +
                 "b + ' ' + a";

    test.equal(evaluate(script, { a: 'parent' }), "parent child");
    test.done();
  },

  "Conditional Scope": function (test) {
    var script = "let c = a\n" +
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
