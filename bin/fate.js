#!/usr/bin/env node

"use strict";

function noOp() {}
var commandLine = require('../dist/cli/Interpreter').commandLine;
commandLine(process.argv.slice(2), console, noOp);
