const nodeunit = require('nodeunit');
const fate = require('../../dist/fate');
const helpers = require('../helpers');

const evaluate = fate.evaluate;
const evaluateEmit = helpers.evaluateEmit;

exports.scope = nodeunit.testCase({
  setUp(callback) {
    this.globals = { greeting: 'Hello, World!' };

    callback();
  },

  'Shadow Local Scope': function (test) {
    const script1 = `let greeting = 'Not Hello'
                   def localGreeting()
                     let greeting = 'Local Hello'
                     return greeting
                   end
                   localGreeting() + ' ' + greeting`;

    const script2 = `let greeting = 'Not Hello'
                   def localGreeting()
                     let greeting = 'Local Hello'
                     def evenMoreLocalGreeting()
                       let greeting = 'More Local Hello'
                       return greeting
                     end
                     return evenMoreLocalGreeting() + ' ' + greeting
                   end
                   localGreeting() + ' ' + greeting`;

    test.equal(evaluate(script1, this.globals), 'Local Hello Not Hello');
    test.equal(evaluate(script2, this.globals),
               'More Local Hello Local Hello Not Hello');
    test.equal(evaluate('global.greeting', this.globals), 'Hello, World!');

    test.throws(function () {
      evaluate('greeting', this.globals);
    });

    test.done();
  },

  'Inherit Local Scope': function (test) {
    const script1 = `let greeting = 'Outer Hello'
                   def localGreeting()
                     global.emit(greeting)
                     let greeting = 'Inner Hello'
                     global.emit(greeting)
                   end
                   localGreeting()
                   global.emit(greeting)`;

    test.deepEqual(evaluateEmit(script1), ['Outer Hello', 'Inner Hello', 'Outer Hello']);
    test.done();
  },

  'Scope Override': function (test) {
    const script = `let b = global.a
                  let a = 'child'
                  b + ' ' + a`;

    test.equal(evaluate(script, { a: 'parent' }), 'parent child');
    test.done();
  },

  'Conditional Scope': function (test) {
    const script = `let a=global.a, b=global.b
                  let c = a
                  if b
                    let a = 'child'
                    let d = a
                  end
                  c + ' ' + d + ' ' + b + ' ' + a`;

    test.equal(evaluate(script, { a: 'parent', b: true }),
               'parent child true child');
    test.done();
  },
});
