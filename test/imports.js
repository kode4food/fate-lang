"use strict";

var nodeunit = require('nodeunit');
var helpers = require('./helpers');

var fate = require('../dist/Fate');
var compile = fate.compile;
var evaluate = fate.evaluate;
var globals = fate.globals;

var types = require('../dist/Types');
var isObject = types.isObject;
var createModule = types.createModule;

var resolvers = require('../dist/resolvers');
var createMemoryResolver = resolvers.createMemoryResolver;
var createFileResolver = resolvers.createFileResolver;

var Runtime = require('../dist/Runtime');

exports.imports = nodeunit.testCase({

  "helper imports": nodeunit.testCase({
    setUp: function (callback) {
      var resolver = createMemoryResolver();
      this.memoryResolver = resolver;
      Runtime.resolvers().push(resolver);

      var compiled = compile("'hello compiled!'");
      var generatedModule = createModule();
      compiled(globals(), generatedModule.exports);
      resolver.register('compiled', generatedModule);

      resolver.register('hello', "'hello world!'");
      resolver.register('helpers', {
        testHelper: function testHelper(arg1, arg2) {
          return "arg1=" + arg1 + ":arg2=" + arg2;
        }
      });

      callback();
    },

    tearDown: function (callback) {
      this.memoryResolver.unregister('hello');
      this.memoryResolver.unregister('helpers');
      Runtime.resolvers().pop();
      callback();
    },

    "Helper Import": function (test) {
      var script1 = "import helpers\n" +
                    "helpers.testHelper(1,2)";

      var script2 = "from helpers import testHelper as test\n" +
                    "test(5,6)";

      var exports1 = Runtime.resolve('hello');
      var exports2 = Runtime.resolve('helpers');

      test.ok(isObject(exports1));
      test.ok(isObject(exports2));
      test.equal(evaluate(script1), "arg1=1:arg2=2");
      test.equal(evaluate(script2), "arg1=5:arg2=6");
      test.throws(() => {
        Runtime.registerModule(99);
      }, "Registering nonsense should explode");
      test.done();
    }
  }),

  "file system importer": nodeunit.testCase({
    setUp: function (callback) {
      Runtime.resolvers().push(createFileResolver({ path: "./test" }));
      callback();
    },

    tearDown: function (callback) {
      Runtime.resolvers().pop();
      callback();
    },

    "Module Retrieval": function (test) {
      var found = Runtime.resolve('test');
      var notFound = Runtime.resolve('unknown');
      test.ok(isObject(found));
      test.equal(notFound, undefined);
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
      test.equal(evaluate(script1), "right!"); // still works!
      test.equal(evaluate(script2), "right!");
      test.equal(evaluate(script3), "wrong!");

      test.throws(() => {
        evaluate("import './bogus2.fate.js' as module");
      }, "should throw module not resolved");

      test.done();
    }
  }),

  "system imports": nodeunit.testCase({
    setUp: function (callback) {
      callback();
    },

    "System Import": function (test) {
      test.equal(evaluate("import math\nmath.round(9.5)"), 10);

      var array = Runtime.resolve('array');

      test.equal(typeof array, 'object');
      test.equal(typeof array.join, 'function');

      test.throws(() => {
        array.first('hello');
      });

      test.throws(() => {
        array.last('hello');
      });

      test.throws(() => {
        array.length(37)
      });

      test.throws(() => {
        array.length({ name: 'fate', age: 1 })
      });

      test.done();
    },

    "Bound System Import": function (test) {
      var script = "from array import join\n" +
                   "let a = ['this', 'is', 'an', 'array']\n" +
                   "let j = join(?, '///')\n" +
                   "a | j";

      test.equal(evaluate(script), "this///is///an///array");
      test.done();
    },

    "Math Constant Import": function (test) {
      test.equal(evaluate("import math\nmath.E"), Math.E);
      test.equal(evaluate("import math\nmath.PI"), Math.PI);
      test.done();
    },

    "Missing Module Import": function (test) {
      test.throws(() => {
        evaluate("import bogus1");
      }, "should throw module not resolved");
      test.done();
    }
  })
});
