#!/usr/bin/env node
require('../dist/cli/interpreter').commandLine(
  process.argv.slice(2), console, () => {},
);
