#!/usr/bin/env node
require('../dist/cli/Compiler')['commandLine'](
  process.argv.slice(2), console, process.exit
);
