"use strict";

var nodeunit = require('nodeunit');
var fate = require('../build/fate');
var createFileResolver = fate.Resolvers.createFileResolver;

fate.Runtime.resolvers().push(createFileResolver({
  path: "./test/scripts", compile: true, monitor: false
}));

function scriptTestCase(moduleName) {
  return nodeunit.testCase(fate.Runtime.resolveExports(moduleName));
}

exports.scripts = nodeunit.testCase({
  "Basics": scriptTestCase('basics'),
  "Joins": scriptTestCase('join')
});
