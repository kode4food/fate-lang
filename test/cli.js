"use strict";

var fs = require('fs');
var path = require('path');
var nodeunit = require('nodeunit');
var compiler = require('../build/cli/Compiler').commandLine;
var interpreter = require('../build/cli/Interpreter').commandLine;
var Global = require('../build/Global').default;
var helpers = require('./helpers');
var createConsole = helpers.createConsole;

var fate = require('../build/Fate');
var isObject = require('../build/Types').isObject;

exports.cli = nodeunit.testCase({
  "Command Line Help": function (test) {
    var cons = createConsole();
    compiler([], cons, function (exitCode) {
      test.ok(cons.contains("Usage"));
      test.done();
    });
  },

  "Bad Arguments": function (test) {
    var cons = createConsole();
    compiler(["--poo"], cons, function (exitCode) {
      test.ok(cons.contains("Usage"));
      test.done();
    });
  },

  "Successful Parse": function (test) {
    var cons = createConsole();
    compiler(["--in", "./test/cli_success"], cons, function () {
      test.ok(cons.contains("Fate Parsing Complete"));
      test.ok(cons.contains("Success"));
      test.ok(!cons.contains("Warnings"));
      test.ok(!cons.contains("Failures"));

      helpers.monkeyPatchRequires('./test', {
        'fatejs': '../../build/Fate'
      });

      var compiled = require('./cli_success/test1.fate.js');
      test.ok(isObject(compiled));

      // cleanup
      fs.unlinkSync("./test/cli_success/test1.fate.js");
      fs.unlinkSync("./test/cli_success/test2.fate.js");

      test.done();
    });
  },

  "Warning Parse": function (test) {
    var cons = createConsole();
    compiler(["--in", "./test/cli_warning"], cons, function (exitCode) {
      test.ok(cons.contains("Fate Parsing Complete"));
      test.ok(cons.contains("Success"));
      test.ok(cons.contains("Warnings"));
      test.ok(!cons.contains("Failures"));
      fs.unlinkSync("./test/cli_warning/test1.fate.js"); // cleanup
      test.done();
    });
  },

  "Failure Parse": function (test) {
    var cons = createConsole();
    compiler(["--in", "./test/cli_failure"], cons, function (exitCode) {
      test.ok(cons.contains("Fate Parsing Complete"));
      test.ok(!cons.contains("Success"));
      test.ok(!cons.contains("Warnings"));
      test.ok(cons.contains("Failures"));
      test.done();
    });
  },

  "Empty Path": function (test) {
    var cons = createConsole();
    compiler(["--in", "./test/cli_empty"], cons, function (exitCode) {
      test.ok(!cons.contains("Fate Parsing Complete"));
      test.ok(!cons.contains("Success"));
      test.ok(!cons.contains("Warnings"));
      test.ok(cons.contains("Error!"));
      test.ok(cons.contains("No files found matching"));
      test.done();
    });
  },

  "Parse Only": function (test) {
    var cons = createConsole();
    compiler(["--parse", "--in", "./test/cli_success"], cons, function (exitCode) {
      test.ok(cons.contains("Fate Parsing Complete"));
      test.ok(cons.contains("Success"));
      test.ok(!cons.contains("Warnings"));
      test.ok(!cons.contains("Failures"));
      test.done();
    });
  },

  "Multiple Input Paths": function (test) {
    var cons = createConsole();
    compiler(["--parse", "--in", "./test/cli_success",
              "--in", "./test/cli_warning"], cons, function (exitCode) {
      test.ok(cons.contains("Fate Parsing Complete"));
      test.ok(cons.contains("Success"));
      test.ok(cons.contains("Warnings"));
      test.ok(!cons.contains("Failures"));
      test.done();
    });
  },

  "Interpreter": function (test) {
    var cons, printHolder, consoleHolder;
    start();

    function start() {
      cons = createConsole();
      printHolder = Global.print;
      consoleHolder = Global.node.console;
      Global.print = cons.log.bind(cons.log);
      Global.node.console = cons;
      successTest();
    }

    function successTest() {
      interpreter(["./test/hello"], cons, function (exitCode) {
        test.equal(exitCode, 0);
        test.ok(cons.contains("Hello, World!"));
        noArgsTest();
      });
    }

    function noArgsTest() {
      interpreter([], cons, function (exitCode) {
        test.equal(exitCode, 0);
        test.ok(cons.contains("Usage"));
        badArgsTest();
      });
    }

    function badArgsTest() {
      interpreter(["--poop"], cons, function (exitCode) {
        test.equal(exitCode, -1);
        test.ok(cons.contains("Usage"));
        finish();
      });
    }

    function finish() {
      Global.print = printHolder;
      Global.node.console = consoleHolder;
      test.done();
    }
  }
});
