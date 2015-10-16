"use strict";

var nodeunit = require('nodeunit');
var commandLine = require('../lib/cli').commandLine;
var helpers = require('./helpers');
var createConsole = helpers.createConsole;

var fate = require('../build/fate');
var createMemoryResolver = fate.Resolvers.createMemoryResolver;
var createFileResolver = fate.Resolvers.createFileResolver;

function evaluate(script, context) {
  var template = fate.compile(script);
  return template(context);
}

exports.imports = nodeunit.testCase({

  "helper imports": nodeunit.testCase({
    setUp: function (callback) {
      var resolver = createMemoryResolver();
      fate.Runtime.resolvers().push(resolver);

      resolver.registerModule('hello', "'hello world!'");
      resolver.registerModule('helpers', {
        testHelper: function testHelper(arg1, arg2) {
          return "arg1=" + arg1 + ":arg2=" + arg2;
        }
      });

      callback();
    },

    tearDown: function (callback) {
      fate.Runtime.resolvers().pop();
      callback();
    },

    "Helper Import": function (test) {
      var script1 = "import helpers\n" +
                    "helpers.testHelper(1,2)";

      var script2 = "from helpers import testHelper as test\n" +
                    "test(5,6)";

      var module1 = fate.Runtime.resolveModule('hello');
      var exports1 = fate.Runtime.resolveExports('hello');
      var module2 = fate.Runtime.resolveModule('helpers');
      var exports2 = fate.Runtime.resolveExports('helpers');

      test.equal(typeof module1, 'function');
      test.equal(typeof module2, 'function');
      test.equal(typeof exports1, 'object');
      test.equal(typeof exports2, 'object');
      test.equal(evaluate(script1), "arg1=1:arg2=2");
      test.equal(evaluate(script2), "arg1=5:arg2=6");
      test.throws(function () {
        fate.Runtime.registerModule(99);
      }, "Registering nonsense should explode");
      test.done();
    }
  }),

  "compiled and monitored": createFileImportTests(true, true),
  "compiled and cached": createFileImportTests(true, false),
  "required and monitored": createFileImportTests(false, true),
  "required and cached": createFileImportTests(false, false),

  "system imports": nodeunit.testCase({
    setUp: function (callback) {
      callback();
    },

    "System Import": function (test) {
      test.equal(evaluate("import math\nmath.round(9.5)"), 10);

      var list = fate.Runtime.resolveModule('list');
      var listExports = fate.Runtime.resolveExports('list');

      test.equal(typeof list, 'function');
      test.equal(typeof listExports, 'object');
      test.equal(typeof listExports.join, 'function');
      test.equal(list(), undefined);
      test.equal(listExports.first('hello'), 'hello');
      test.equal(listExports.last('hello'), 'hello');
      test.equal(listExports.length(37), 0);
      test.equal(listExports.length({ name: 'fate', age: 1 }), 2);
      test.done();
    },

    "Bound System Import": function (test) {
      var script = "from list import join\n" +
                   "let a = ['this', 'is', 'a', 'list']\n" +
                   "let j = join(?, '///')\n" +
                   "a | j";

      test.equal(evaluate(script), "this///is///a///list");
      test.done();
    },

    "Math Constant Import": function (test) {
      test.equal(evaluate("import math\nmath.E"), Math.E);
      test.equal(evaluate("import math\nmath.PI"), Math.PI);
      test.done();
    },

    "Missing Module Import": function (test) {
      test.throws(function () {
        evaluate("import bogus");
      }, "should throw module not resolved");
      test.done();
    }
  })
});

function createFileImportTests(compile, monitor) {
  return nodeunit.testCase({
    setUp: function (callback) {
      fate.Runtime.resolvers().push(createFileResolver({
        path: "./test", compile: compile, monitor: monitor
      }));

      if ( compile ) {
        callback();
        return;
      }

      // command-line build the files
      commandLine(["-in", "./test"], createConsole(), function (exitCode) {
        helpers.monkeyPatchRequires('./test', {
          'fatejs': '../build/fate'
        });
        callback();
      });
    },

  tearDown: function (callback) {
      if ( !compile ) {
        helpers.deleteBuildProducts('./test');
      }
      fate.Runtime.resolvers().pop();
      callback();
    },

    "Module Retrieval": function (test) {
      var found1 = fate.Runtime.resolveModule('test');
      var found2 = fate.Runtime.resolveModule('test');
      var found3 = fate.Runtime.resolveExports('test');
      var notFound1 = fate.Runtime.resolveModule('unknown');
      var notFound2 = fate.Runtime.resolveModule('unknown');
      var notFound3 = fate.Runtime.resolveExports('unknown');
      test.equal(found1(), "There are no people!");
      test.equal(found2(), "There are no people!");
      test.equal(typeof found3, 'object');
      test.equal(notFound1, undefined);
      test.equal(notFound2, undefined);
      test.equal(notFound3, undefined);
      test.done();
    },

    "File Import": function (test) {
      var script = "import test as t\n" +
                   "t.renderTest('Curly')";

      test.equal(evaluate(script), "Hello Curly");
      test.done();
    },

    "File Submodule Import": function (test) {
      var script1 = "import module1\nmodule1.test_value";
      var script2 = "import module2\nmodule2.test_value";
      var script3 = "import module1.index\nindex.test_value";

      test.equal(evaluate(script1), "right!");
      test.equal(evaluate(script2), "right!");
      test.equal(evaluate(script3), "wrong!");
      test.done();
    }
  });
}
