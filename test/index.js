"use strict";

// Needed to enable Fate script require()
var fate = require('../build/fate');

exports.api = require('./api').api;
exports.basics = require('./basics').basics;
exports.calls = require('./calls').calls;
exports.cli = require('./cli').cli;
exports.codepaths = require('./codepaths').codepaths;
exports.imports = require('./imports').imports;
exports.lambda = require('./lambda').lambda;
exports.like = require('./like').like;
exports.lists = require('./lists').lists;
exports.loops = require('./loops').loops;
exports.scope = require('./scope').scope;
exports.strings = require('./strings').strings;
exports.math = require('./math').math;
exports.when = require('./when').when;

exports["Pure Fate API"] = require('./api_pure').tests;
exports["Pure Fate Basics"] = require('./basics_pure').tests;
exports["Pure Fate Calls"] = require('./calls_pure').tests;
exports["Pure Fate Functions"] = require('./function_pure').tests;
exports["Pure Fate Imports"] = require('./import_pure').tests;
exports["Pure Fate Joins"] = require('./join_pure').tests;
exports["Pure Fate Lambdas"] = require('./lambda_pure').tests;
exports["Pure Fate Assignment"] = require('./assign_pure').tests;
