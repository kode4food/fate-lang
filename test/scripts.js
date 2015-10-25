"use strict";

var nodeunit = require('nodeunit');
var fate = require('../build/fate');

function scriptTestCase(moduleName) {
  var module = require('./scripts/' + moduleName + '.fate');
  return nodeunit.testCase(module);
}

exports.scripts = nodeunit.testCase({
  "API": scriptTestCase('api'),
  "Basics": scriptTestCase('basics'),
  "Functions": scriptTestCase('function'),
  "Joins": scriptTestCase('join'),
  "Imports": scriptTestCase('import')
});
