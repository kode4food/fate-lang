"use strict";

var nodeunit = require('nodeunit');
var helpers = require('./helpers');

var fate = require('../build/fate');
var createMemoryResolver = fate.Resolvers.createMemoryResolver;
var createFileResolver = fate.Resolvers.createFileResolver;
var evaluate = fate.evaluate;

exports.imports = nodeunit.testCase({

  "helper imports": nodeunit.testCase({
    setUp: function (callback) {
      var resolver = createMemoryResolver();
      fate.Runtime.resolvers().push(resolver);

      resolver.register('hello', "'hello world!'");
      resolver.register('helpers', {
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

      var exports1 = fate.Runtime.resolve('hello');
      var exports2 = fate.Runtime.resolve('helpers');

      test.ok(fate.Types.isObject(exports1));
      test.ok(fate.Types.isObject(exports2));
      test.equal(evaluate(script1), "arg1=1:arg2=2");
      test.equal(evaluate(script2), "arg1=5:arg2=6");
      test.throws(function () {
        fate.Runtime.registerModule(99);
      }, "Registering nonsense should explode");
      test.done();
    }
  }),

  "file system importer": nodeunit.testCase({
    setUp: function (callback) {
      fate.Runtime.resolvers().push(createFileResolver({ path: "./test" }));
      callback();
    },

    tearDown: function (callback) {
      fate.Runtime.resolvers().pop();
      callback();
    },

    "Module Retrieval": function (test) {
      var found = fate.Runtime.resolve('test');
      var notFound = fate.Runtime.resolve('unknown');
      test.ok(fate.Types.isObject(found));
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
      test.equal(evaluate(script2), "right!");
      test.equal(evaluate(script3), "wrong!");
      test.done();
    }
  }),

  "system imports": nodeunit.testCase({
    setUp: function (callback) {
      callback();
    },

    "System Import": function (test) {
      test.equal(evaluate("import math\nmath.round(9.5)"), 10);

      var list = fate.Runtime.resolve('list');

      test.equal(typeof list, 'object');
      test.equal(typeof list.join, 'function');
      test.equal(list.first('hello'), 'hello');
      test.equal(list.last('hello'), 'hello');
      test.equal(list.length(37), 0);
      test.equal(list.length({ name: 'fate', age: 1 }), 2);
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
