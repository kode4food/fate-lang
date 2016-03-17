"use strict";

const nodeunit = require('nodeunit');
const GlobalScheduler = require('../dist/Scheduler').GlobalScheduler;

exports.scheduler = nodeunit.testCase({

  "Scheduler": function (test) {
    let count = 200;
    let remaining = count;
    test.expect(count);
    for ( let i = 0; i < count; i++ ) {
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
