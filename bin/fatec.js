#!/usr/bin/env node
require('../dist/cli/compiler').commandLine(
  process.argv.slice(2), console, process.exit,
);
