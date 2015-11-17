"use strict";

var nodeunit = require('nodeunit');
var fate = require('../build/fate');
var GlobalScheduler = fate.GlobalScheduler;

exports.scheduler = nodeunit.testCase({

  "Scheduler": function (test) {
    var count = 200;
    var remaining = count;
    test.expect(count);
    for ( var i = 0; i < count; i++ ) {
      setTimeout(scheduleTest(i), Math.random() * 50);
    }

    function scheduleTest(index1) {
      GlobalScheduler.queue(function (index2) {
        test.equal(index1, index2);
        if ( !--remaining ) {
          test.done();
        }
      }, [index1]);
    }
  }

});
