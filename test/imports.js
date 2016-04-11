"use strict";

const nodeunit = require('nodeunit');
const helpers = require('./helpers');

const fate = require('../dist/Fate');
const compile = fate.compile;
const evaluate = fate.evaluate;
const globals = fate.globals;

const types = require('../dist/Types');
const isObject = types.isObject;
const createModule = types.createModule;

const resolvers = require('../dist/resolvers');
const createMemoryResolver = resolvers.createMemoryResolver;
const createFileResolver = resolvers.createFileResolver;

const Runtime = require('../dist/Runtime');

exports.imports = nodeunit.testCase({

  "helper imports": nodeunit.testCase({
    setUp: function (callback) {
      let resolver = createMemoryResolver();
      this.memoryResolver = resolver;
      Runtime.resolvers().push(resolver);

      let compiled = compile("'hello compiled!'");
      let generatedModule = createModule();
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
      let script1 = "import helpers\n" +
                    "helpers.testHelper(1,2)";

      let script2 = "from helpers import testHelper as test\n" +
                    "test(5,6)";

      let exports1 = Runtime.resolve('hello');
      let exports2 = Runtime.resolve('helpers');

      test.ok(isObject(exports1));
      test.ok(isObject(exports2));
      test.equal(evaluate(script1), "arg1=1:arg2=2");
      test.equal(evaluate(script2), "arg1=5:arg2=6");
      test.throws(function () {
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
      let found = Runtime.resolve('test');
      let notFound = Runtime.resolve('unknown');
      test.ok(isObject(found));
      test.equal(notFound, undefined);
      test.done();
    },

    "File Import": function (test) {
      let script = "import test as t\n" +
                   "t.renderTest('Curly')";

      test.equal(evaluate(script), "Hello Curly");
      test.done();
    },

    "File Submodule Import": function (test) {
      let script1 = "import module1\nmodule1.test_value";
      let script2 = "import module2\nmodule2.test_value";
      let script3 = "import module1.index\nindex.test_value";

      test.equal(evaluate(script1), "right!");
      test.equal(evaluate(script1), "right!"); // still works!
      test.equal(evaluate(script2), "right!");
      test.equal(evaluate(script3), "wrong!");

      test.throws(function () {
        evaluate("import './bogus2' as module");
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

      let array = Runtime.resolve('array');

      test.equal(typeof array, 'object');
      test.equal(typeof array.join, 'function');

      test.throws(function () {
        array.first('hello');
      });

      test.throws(function () {
        array.last('hello');
      });

      test.throws(function () {
        array.length(37)
      });

      test.throws(function () {
        array.length({ name: 'fate', age: 1 })
      });

      test.done();
    },

    "Bound System Import": function (test) {
      let script = "from array import join\n" +
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
      test.throws(function () {
        evaluate("import bogus1");
      }, "should throw module not resolved");
      test.done();
    }
  })
});
