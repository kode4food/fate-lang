const nodeunit = require('nodeunit');

const fate = require('../../dist/fate');

const compile = fate.compile;
const evaluate = fate.evaluate;
const globals = fate.globals;
const createModule = fate.createModule;

const resolvers = require('../../dist/resolvers');

const createMemoryResolver = resolvers.createMemoryResolver;
const createFileResolver = resolvers.createFileResolver;

const runtime = require('../../dist/runtime');

exports.imports = nodeunit.testCase({

  'helper imports': nodeunit.testCase({
    setUp(callback) {
      const resolver = createMemoryResolver();
      this.memoryResolver = resolver;
      runtime.resolvers().push(resolver);

      const compiled = compile("'hello compiled!'");
      const generatedModule = createModule();
      compiled(globals(), generatedModule.exports);
      resolver.register('compiled', generatedModule);

      resolver.register('hello', "'hello world!'");
      resolver.register('helpers', {
        testHelper: function testHelper(arg1, arg2) {
          return `arg1=${arg1}:arg2=${arg2}`;
        },
      });

      callback();
    },

    tearDown(callback) {
      this.memoryResolver.unregister('hello');
      this.memoryResolver.unregister('helpers');
      runtime.resolvers().pop();
      callback();
    },

    'Helper Import': function (test) {
      const script1 = `import helpers
                     helpers.testHelper(1,2)`;

      const script2 = `from helpers import testHelper as test
                     test(5,6)`;

      const exports1 = runtime.resolve('hello');
      const exports2 = runtime.resolve('helpers');

      test.ok(runtime.isObject(exports1));
      test.ok(runtime.isObject(exports2));
      test.equal(evaluate(script1), 'arg1=1:arg2=2');
      test.equal(evaluate(script2), 'arg1=5:arg2=6');
      test.throws(() => {
        runtime.registerModule(99);
      }, 'Registering nonsense should explode');
      test.done();
    },
  }),

  'file system importer': nodeunit.testCase({
    setUp(callback) {
      runtime.resolvers().push(createFileResolver({ path: './test/assets' }));
      callback();
    },

    tearDown(callback) {
      runtime.resolvers().pop();
      callback();
    },

    'Module Retrieval': function (test) {
      const found = runtime.resolve('test');
      const notFound = runtime.resolve('unknown');
      test.ok(runtime.isObject(found));
      test.equal(notFound, undefined);
      test.done();
    },

    'File Import': function (test) {
      const script = `import test as t
                    t.renderTest('Curly')`;

      test.equal(evaluate(script), 'Hello Curly');
      test.done();
    },

    'File Submodule Import': function (test) {
      const script1 = `import module1
                     module1.test_value`;
      const script2 = `import module2
                     module2.test_value`;
      const script3 = `import module1.index
                     index.test_value`;

      test.equal(evaluate(script1), 'right!');
      test.equal(evaluate(script1), 'right!'); // still works!
      test.equal(evaluate(script2), 'right!');
      test.equal(evaluate(script3), 'wrong!');

      test.throws(() => {
        evaluate("import './bogus2' as module");
      }, 'should throw module not resolved');

      test.done();
    },
  }),

  'system imports': nodeunit.testCase({
    setUp(callback) {
      callback();
    },

    'System Import': function (test) {
      test.equal(evaluate(`
        import math
        math.round(9.5)
      `), 10);

      const array = runtime.resolve('array');

      test.equal(typeof array, 'object');
      test.equal(typeof array.join, 'function');

      test.throws(() => {
        array.first('hello');
      });

      test.throws(() => {
        array.last('hello');
      });

      test.throws(() => {
        array.length(37);
      });

      test.throws(() => {
        array.length({ name: 'fate', age: 1 });
      });

      test.done();
    },

    'Bound System Import': function (test) {
      const script = `from array import join
                    let a = ['this', 'is', 'an', 'array']
                    let j = join(_, '///')
                    a | j`;

      test.equal(evaluate(script), 'this///is///an///array');
      test.done();
    },

    'Math Constant Import': function (test) {
      test.equal(evaluate(`
        import math
        math.E
      `), Math.E);

      test.equal(evaluate(`
        import math
        math.PI
      `), Math.PI);

      test.done();
    },

    'Missing Module Import': function (test) {
      test.throws(() => {
        evaluate('import bogus1');
      }, 'should throw module not resolved');
      test.done();
    },
  }),
});
