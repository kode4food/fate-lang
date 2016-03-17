"use strict";

const fs = require('fs');
const path = require('path');
const nodeunit = require('nodeunit');
const compiler = require('../dist/cli/Compiler').commandLine;
const interpreter = require('../dist/cli/Interpreter').commandLine;
const Global = require('../dist/Global').default;
const helpers = require('./helpers');
const createConsole = helpers.createConsole;

const fate = require('../dist/Fate');
const isObject = require('../dist/Types').isObject;

exports.cli = nodeunit.testCase({
  "Command Line Help": function (test) {
    let cons = createConsole();
    compiler([], cons, function () {
      test.ok(cons.contains("Usage"));
      test.done();
    });
  },

  "Bad Arguments": function (test) {
    let cons = createConsole();
    compiler(["--poo"], cons, function () {
      test.ok(cons.contains("Usage"));
      test.done();
    });
  },

  "Successful Parse": function (test) {
    let cons = createConsole();
    compiler(["--in", "./test/cli_success"], cons, function () {
      test.ok(cons.contains("Fate Parsing Complete"));
      test.ok(cons.contains("Success"));
      test.ok(!cons.contains("Warnings"));
      test.ok(!cons.contains("Failures"));

      helpers.monkeyPatchRequires('./test', {
        'fatejs': '../../dist/Fate'
      });

      let compiled = require('./cli_success/test1.fate.js');
      test.ok(isObject(compiled));

      // cleanup
      fs.unlinkSync("./test/cli_success/test1.fate.js");
      fs.unlinkSync("./test/cli_success/test2.fate.js");

      test.done();
    });
  },

  "Warning Parse": function (test) {
    let cons = createConsole();
    compiler(["--in", "./test/cli_warning"], cons, function () {
      test.ok(cons.contains("Fate Parsing Complete"));
      test.ok(cons.contains("Success"));
      test.ok(cons.contains("Warnings"));
      test.ok(!cons.contains("Failures"));
      fs.unlinkSync("./test/cli_warning/test1.fate.js"); // cleanup
      test.done();
    });
  },

  "Failure Parse": function (test) {
    let cons = createConsole();
    compiler(["--in", "./test/cli_failure"], cons, function () {
      test.ok(cons.contains("Fate Parsing Complete"));
      test.ok(!cons.contains("Success"));
      test.ok(!cons.contains("Warnings"));
      test.ok(cons.contains("Failures"));
      test.done();
    });
  },

  "Empty Path": function (test) {
    let cons = createConsole();
    compiler(["--in", "./test/cli_empty"], cons, function () {
      test.ok(!cons.contains("Fate Parsing Complete"));
      test.ok(!cons.contains("Success"));
      test.ok(!cons.contains("Warnings"));
      test.ok(cons.contains("Error!"));
      test.ok(cons.contains("No files found matching"));
      test.done();
    });
  },

  "Parse Only": function (test) {
    let cons = createConsole();
    compiler(["--parse", "--in", "./test/cli_success"], cons, function () {
      test.ok(cons.contains("Fate Parsing Complete"));
      test.ok(cons.contains("Success"));
      test.ok(!cons.contains("Warnings"));
      test.ok(!cons.contains("Failures"));
      test.done();
    });
  },

  "Multiple Input Paths": function (test) {
    let cons = createConsole();
    compiler(["--parse", "--in", "./test/cli_success",
              "--in", "./test/cli_warning"], cons, function () {
      test.ok(cons.contains("Fate Parsing Complete"));
      test.ok(cons.contains("Success"));
      test.ok(cons.contains("Warnings"));
      test.ok(!cons.contains("Failures"));
      test.done();
    });
  },

  "Interpreter": function (test) {
    let cons, printHolder, consoleHolder;
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
