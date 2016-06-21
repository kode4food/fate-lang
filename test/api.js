"use strict";

const nodeunit = require('nodeunit');
const runtime = require('../dist/Runtime');
const support = require('../dist/modules/support');

exports.api = nodeunit.testCase({

  "True / False": function (test) {
    test.equal(runtime.isTrue(runtime.isNothing), true);
    test.equal(runtime.isTrue(runtime.isSomething), true);
    test.equal(runtime.isTrue(null), false);
    test.equal(runtime.isTrue(undefined), false);
    test.equal(runtime.isTrue(), false);
    test.equal(runtime.isTrue([]), true);
    test.equal(runtime.isTrue({}), true);
    test.equal(runtime.isTrue(0), true);
    test.equal(runtime.isTrue({ name: 'fate' }), true);
    test.equal(runtime.isTrue("hello"), true);
    test.equal(runtime.isTrue([1]), true);
    test.equal(runtime.isFalse(null), true);
    test.equal(runtime.isFalse(), true);
    test.equal(runtime.isFalse([]), false);
    test.equal(runtime.isFalse({}), false);
    test.equal(runtime.isFalse(0), false);
    test.equal(runtime.isFalse({ name: 'fate' }), false);
    test.equal(runtime.isFalse("hello"), false);
    test.equal(runtime.isFalse([1]), false);
    test.done();
  },

  "Support Library Calls": function (test) {
    let Promise = require('welsh').Promise;

    let p = support.make(Promise, function (resolve) {
      resolve('hello');
    });

    test.ok(p instanceof Promise);
    p.then(function (value) {
      test.equal(value, 'hello');
      test.done();
    });
  }
});
