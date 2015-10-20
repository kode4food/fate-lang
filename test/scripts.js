"use strict";

var nodeunit = require('nodeunit');
var fate = require('../build/fate');
var createFileResolver = fate.Resolvers.createFileResolver;

fate.Runtime.resolvers().push(createFileResolver({ path: "./test/scripts" }));

function scriptTestCase(moduleName) {
  return nodeunit.testCase(fate.Runtime.resolve(moduleName));
}

exports.scripts = nodeunit.testCase({
  "Basics": scriptTestCase('basics'),
  "Functions": scriptTestCase('function'),
  "Joins": scriptTestCase('join'),
  "Imports": scriptTestCase('import')
});
