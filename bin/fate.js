#!/usr/bin/env node
require('../dist/cli/Interpreter')['commandLine'](
  process.argv.slice(2), console, function noOp() {}
);
