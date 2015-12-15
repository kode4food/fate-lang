#!/usr/bin/env node

"use strict";

function noOp() {}
var commandLine = require('../build/cli/Interpreter').commandLine;
commandLine(process.argv.slice(2), console, noOp);
