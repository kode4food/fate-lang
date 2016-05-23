"use strict";

const fs = require('fs');
const path = require('path');
const nodeunit = require('nodeunit');
const compiler = require('../dist/cli/Compiler')['commandLine'];
const interpreter = require('../dist/cli/Interpreter')['commandLine'];
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

  "Successful Compile": function (test) {
    let cons = createConsole();
    compiler(["./test/cli_success/*.fate"], cons, function () {
      test.ok(cons.contains("Fate Compilation Complete"));
      test.ok(cons.contains("Success"));
      test.ok(!cons.contains("Warnings"));
      test.ok(!cons.contains("Failures"));

      helpers.monkeyPatchRequires('./test', {
        'fatejs': '../../dist/Fate'
      });

      let compiled = require('./cli_success/test1.js');
      test.ok(isObject(compiled));

      // cleanup
      fs.unlinkSync("./test/cli_success/test1.js");
      fs.unlinkSync("./test/cli_success/test2.js");

      test.done();
    });
  },

  "Warning Compile": function (test) {
    let cons = createConsole();
    compiler(["./test/cli_warning/*.fate"], cons, function () {
      test.ok(cons.contains("Fate Compilation Complete"));
      test.ok(cons.contains("Success"));
      test.ok(cons.contains("Warnings"));
      test.ok(cons.contains("will replace the previous definition(s)"));
      test.ok(cons.contains("sure you wanted to immediately reassign 'a'?"));
      test.ok(cons.contains("sure you wanted to immediately reassign 'b'?"));
      test.ok(!cons.contains("Failures"));
      fs.unlinkSync("./test/cli_warning/test1.js"); // cleanup
      test.done();
    });
  },

  "Failure Compile": function (test) {
    let cons = createConsole();
    compiler(["--in", "./test/cli_failure/"], cons, function () {
      test.ok(cons.contains("Fate Compilation Complete"));
      test.ok(!cons.contains("Success"));
      test.ok(!cons.contains("Warnings"));
      test.ok(cons.contains("Failures"));
      test.done();
    });
  },

  "Empty Path": function (test) {
    let cons = createConsole();
    compiler(["./test/cli_empty/*.fate"], cons, function () {
      test.ok(!cons.contains("Fate Compilation Complete"));
      test.ok(!cons.contains("Success"));
      test.ok(!cons.contains("Warnings"));
      test.ok(cons.contains("Error!"));
      test.ok(cons.contains("No files found matching"));
      test.done();
    });
  },

  "Parse Only": function (test) {
    let cons = createConsole();
    compiler(["--parse", "./test/cli_success/*.fate"], cons, function () {
      test.ok(cons.contains("Fate Compilation Complete"));
      test.ok(cons.contains("Success"));
      test.ok(!cons.contains("Warnings"));
      test.ok(!cons.contains("Failures"));
      test.done();
    });
  },

  "Clean Compiled Files": function (test) {
    let cons = createConsole();

    compiler(["./test/cli_success/*.fate"], cons, function () {
      test.ok(cons.contains("Fate Compilation Complete"));
      test.ok(cons.contains("Success"));
      test.ok(!cons.contains("Warnings"));
      test.ok(!cons.contains("Failures"));

      compiler(["--clean", "./test/**/*.fate"], cons, function () {
        test.ok(cons.contains("Deleted: 2"));
        test.done();
      });
    });
  },

  "Mutually Exclusive Actions": function (test) {
    let cons = createConsole();

    compiler(["--clean", "--parse"], cons, function () {
      test.ok(cons.contains("Error!"));
      test.ok(cons.contains("Only one action can be performed"));
      test.done();
    });
  },

  "Multiple Input Paths": function (test) {
    let cons = createConsole();
    compiler(["--parse", "./test/cli_success/*.fate",
              "./test/cli_warning/*.fate"], cons, function () {
      test.ok(cons.contains("Fate Compilation Complete"));
      test.ok(cons.contains("Success"));
      test.ok(cons.contains("Warnings"));
      test.ok(!cons.contains("Failures"));
      test.done();
    });
  },

  "Interpreter": function (test) {
    let cons, logHolder;
    start();

    function start() {
      cons = createConsole();
      logHolder = console.log;
      console.log = cons.log.bind(cons.log);
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
      console.log = logHolder;
      test.done();
    }
  }
});
