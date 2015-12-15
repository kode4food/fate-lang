#!/usr/bin/env node

"use strict";

var commandLine = require('../build/cli/Compiler').commandLine;
commandLine(process.argv.slice(2), console, process.exit);
