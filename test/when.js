"use strict";

var nodeunit = require('nodeunit');
var fate = require('../build/fate');
var evaluate = fate.evaluate;
var helpers = require('./helpers');
var evaluateAsync = helpers.evaluateAsync;

exports.when = nodeunit.testCase({
  "Single Signature - No Arguments": function (test) {
    var script1 = 'when a()\n' +
                  '  emit("hello!")\n' +
                  'end\n' +
                  'return a  # return the channel';

    var channel = evaluateAsync(script1, function (result) {
      test.deepEqual(result, ["hello!"]);
      test.done();
    });

    setTimeout(function () {
      channel(100);
    }, 100);
  },

  "Single Signature - 1 Argument": function (test) {
    var script1 = 'when a(x)\n' +
                  '  emit({x} | "%x received")\n' +
                  'end\n' +
                  'return a  # return the channel';

    var channel = evaluateAsync(script1, function (result) {
      test.deepEqual(result, ["100 received"]);
      test.done();
    });

    setTimeout(function () {
      channel(100);
    }, 100);
  },

  "Multiple Signature - No Arguments": function (test) {
    var script1 = 'when a() & b()\n' +
                  '  emit("hello!")\n' +
                  'end\n' +
                  'return {a,b}  # return the channels';

    var aWasCalled = false;

    var channels = evaluateAsync(script1, function (result) {
      test.ok(aWasCalled);
      test.deepEqual(result, ["hello!"]);
      /* istanbul ignore else */
      if ( aWasCalled ) {
        test.done();
      }
    });

    setTimeout(function () {
      channels.b();
    }, 50);

    setTimeout(function() {
       aWasCalled = true;
       channels.a();
    }, 100);
  },

  "Multiple Signature - With Arguments": function (test) {
    var script1 = 'when a(x, y) & b(z, g, f)\n' +
      '  emit({x, y, z, g, f} | "%x-%y-%z-%g-%f")\n' +
      'end\n' +
      'return {a,b}  # return the channels';

    var aWasCalled = false;

    var channels = evaluateAsync(script1, function (result) {
      test.ok(aWasCalled);
      test.deepEqual(result, ["hello-world-how-are-you?"]);
      /* istanbul ignore else */
      if ( aWasCalled ) {
        test.done();
      }
    });

    setTimeout(function () {
      channels.b("how", "are", "you?", "ignored");
    }, 50);

    setTimeout(function() {
      aWasCalled = true;
      channels.a("hello", "world", "ignored");
    }, 100);
  }
});
