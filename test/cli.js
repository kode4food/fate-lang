const fs = require('fs');
const nodeunit = require('nodeunit');
const compiler = require('../dist/cli/compiler').commandLine;
const interpreter = require('../dist/cli/interpreter').commandLine;
const helpers = require('./helpers');

const createConsole = helpers.createConsole;

const runtime = require('../dist/runtime');

const baseDir = './test/assets';

exports.cli = nodeunit.testCase({
  'Command Line Help': function (test) {
    const cons = createConsole();
    compiler([], cons, () => {
      test.ok(cons.contains('Usage'));
      test.done();
    });
  },

  'Bad Arguments': function (test) {
    const cons = createConsole();
    compiler(['--poo'], cons, () => {
      test.ok(cons.contains('Usage'));
      test.done();
    });
  },

  'Successful Compile': function (test) {
    const cons = createConsole();
    compiler([`${baseDir}/cli_success/*.fate`], cons, () => {
      test.ok(cons.contains('Fate Compilation Complete'));
      test.ok(cons.contains('Success'));
      test.ok(!cons.contains('Warnings'));
      test.ok(!cons.contains('Failures'));

      helpers.monkeyPatchRequires('./test', {
        'fatejs/dist/runtime': '../../../dist/runtime',
        'fatejs/dist/fate': '../../../dist/fate',
      });

      const compiled = require('./assets/cli_success/test1.js');
      test.ok(runtime.isObject(compiled));

      // cleanup
      fs.unlinkSync(`${baseDir}/cli_success/test1.js`);
      fs.unlinkSync(`${baseDir}/cli_success/test2.js`);

      test.done();
    });
  },

  'Warning Compile': function (test) {
    const cons = createConsole();
    compiler([`${baseDir}/cli_warning/*.fate`], cons, () => {
      test.ok(cons.contains('Fate Compilation Complete'));
      test.ok(cons.contains('Success'));
      test.ok(cons.contains('Warnings'));
      test.ok(cons.contains("unguarded Function 'query' will replace "
                            + 'the previous definition(s)'));
      test.ok(cons.contains("sure you wanted to immediately reassign 'a'?"));
      test.ok(cons.contains("sure you wanted to immediately reassign 'b'?"));
      test.ok(!cons.contains('Failures'));
      fs.unlinkSync(`${baseDir}/cli_warning/test1.js`); // cleanup
      test.done();
    });
  },

  'Failure Compile': function (test) {
    const cons = createConsole();
    compiler(['--in', `${baseDir}/cli_failure/`], cons, () => {
      test.ok(cons.contains('Fate Compilation Complete'));
      test.ok(!cons.contains('Success'));
      test.ok(!cons.contains('Warnings'));
      test.ok(cons.contains('Failures'));
      test.ok(cons.contains("Unexpected 'a'"));
      test.done();
    });
  },

  'Empty Path': function (test) {
    const cons = createConsole();
    compiler([`${baseDir}/cli_empty/*.fate`], cons, () => {
      test.ok(!cons.contains('Fate Compilation Complete'));
      test.ok(!cons.contains('Success'));
      test.ok(!cons.contains('Warnings'));
      test.ok(cons.contains('Error!'));
      test.ok(cons.contains('No files found matching'));
      test.done();
    });
  },

  'Parse Only': function (test) {
    const cons = createConsole();
    compiler(['--parse', `${baseDir}/cli_success/*.fate`], cons, () => {
      test.ok(cons.contains('Fate Compilation Complete'));
      test.ok(cons.contains('Success'));
      test.ok(!cons.contains('Warnings'));
      test.ok(!cons.contains('Failures'));
      test.done();
    });
  },

  'Clean Compiled Files': function (test) {
    const cons = createConsole();

    compiler([`${baseDir}/cli_success/*.fate`], cons, () => {
      test.ok(cons.contains('Fate Compilation Complete'));
      test.ok(cons.contains('Success'));
      test.ok(!cons.contains('Warnings'));
      test.ok(!cons.contains('Failures'));

      compiler(['--clean', `${baseDir}/**/*.fate`], cons, () => {
        test.ok(cons.contains('Deleted: 2'));
        test.done();
      });
    });
  },

  'Mutually Exclusive Actions': function (test) {
    const cons = createConsole();

    compiler(['--clean', '--parse'], cons, () => {
      test.ok(cons.contains('Error!'));
      test.ok(cons.contains('Only one action can be performed'));
      test.done();
    });
  },

  'Multiple Input Paths': function (test) {
    const cons = createConsole();
    compiler(['--parse', `${baseDir}/cli_success/*.fate`,
              `${baseDir}/cli_warning/*.fate`], cons, () => {
      test.ok(cons.contains('Fate Compilation Complete'));
      test.ok(cons.contains('Success'));
      test.ok(cons.contains('Warnings'));
      test.ok(!cons.contains('Failures'));
      test.done();
    });
  },

  Interpreter(test) {
    let cons; let
logHolder;
    start();

    function start() {
      cons = createConsole();
      logHolder = console.log;
      console.log = cons.log.bind(cons.log);
      successTest();
    }

    function successTest() {
      interpreter([`${baseDir}/hello`], cons, (exitCode) => {
        test.equal(exitCode, 0);
        test.ok(cons.contains('Hello, World!'));
        noArgsTest();
      });
    }

    function noArgsTest() {
      interpreter([], cons, (exitCode) => {
        test.equal(exitCode, 0);
        test.ok(cons.contains('Usage'));
        badArgsTest();
      });
    }

    function badArgsTest() {
      interpreter(['--poop'], cons, (exitCode) => {
        test.equal(exitCode, -1);
        test.ok(cons.contains('Usage'));
        finish();
      });
    }

    function finish() {
      console.log = logHolder;
      test.done();
    }
  },
});
