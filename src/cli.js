#!/usr/bin/env node

"use strict";

/* istanbul ignore if: untestable */
if ( require.main === module ) {
  var commandLine = require('./CommandLine').commandLine;
  commandLine(process.argv.slice(2), console, process.exit);
}
