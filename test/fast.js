"use strict";

// Needed to enable Fate script require()
var fate = require('../build/fate');

exports["Pure Fate API"] = require('./api_pure').tests;
exports["Pure Fate Basics"] = require('./basics_pure').tests;
exports["Pure Fate Calls"] = require('./calls_pure').tests;
exports["Pure Fate Functions"] = require('./function_pure').tests;
exports["Pure Fate Imports"] = require('./import_pure').tests;
exports["Pure Fate Joins"] = require('./join_pure').tests;
exports["Pure Fate Lambdas"] = require('./lambda_pure').tests;
exports["Pure Fate Assignment"] = require('./assign_pure').tests;
exports["Pure Fate Scopes"] = require('./scope_pure').tests;
