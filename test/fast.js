"use strict";

// Needed to enable Fate script require()
require('../dist/Fate');

exports["Pure Fate API"] = require('./api_pure').tests;
exports["Pure Fate Arguments"] = require('./args_pure').tests;
exports["Pure Fate Basics"] = require('./basics_pure').tests;
exports["Pure Fate Calls"] = require('./calls_pure').tests;
exports["Pure Fate 'Do' Blocks"] = require('./do_pure').tests;
exports["Pure Fate Functions"] = require('./function_pure').tests;
exports["Pure Fate Imports"] = require('./import_pure').tests;
exports["Pure Fate Exports"] = require('./export_pure').tests;
exports["Pure Fate JSON"] = require('./json_pure').tests;
exports["Pure Fate Lambdas"] = require('./lambda_pure').tests;
exports["Pure Fate Assignment"] = require('./assign_pure').tests;
exports["Pure Fate Scopes"] = require('./scope_pure').tests;
exports["Pure Fate Patterns"] = require('./patterns_pure').tests;
exports["Pure Fate Reduce"] = require('./reduce_pure').tests;
exports["Pure Fate Lists"] = require('./lists_pure').tests;
exports["Pure Fate Mutables"] = require('./mutable_pure').tests;