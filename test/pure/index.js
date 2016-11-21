"use strict";

// Needed to enable Fate script require()
require('../../dist/Fate');

exports["Pure Fate API"] = require('./api').tests;
exports["Pure Fate Arguments"] = require('./args').tests;
exports["Pure Fate Basics"] = require('./basics').tests;
exports["Pure Fate Calls"] = require('./calls').tests;
exports["Pure Fate 'Do' Blocks"] = require('./do').tests;
exports["Pure Fate Functions"] = require('./function').tests;
exports["Pure Fate Imports"] = require('./import').tests;
exports["Pure Fate Exports"] = require('./export').tests;
exports["Pure Fate JSON"] = require('./json').tests;
exports["Pure Fate Lambdas"] = require('./lambda').tests;
exports["Pure Fate Assignment"] = require('./assign').tests;
exports["Pure Fate Scopes"] = require('./scope').tests;
exports["Pure Fate Patterns"] = require('./patterns').tests;
exports["Pure Fate Reduce"] = require('./reduce').tests;
exports["Pure Fate Lists"] = require('./lists').tests;
exports["Pure Fate Mutables"] = require('./mutable').tests;