#!/usr/bin/env node

"use strict";

var fs = require('fs');
var path = require('path');
var glob = require('glob');
var mkdirp = require('mkdirp');

var VERSION = require('../build/Fate').VERSION;

var compiler = require('../build/compiler/Compiler');
var compileModule = compiler.compileModule;
var generateNodeModule = compiler.generateNodeModule;
var wrapCompileError = compiler.wrapCompileError;

var OptionRegex = /^-([a-zA-Z][_a-zA-Z0-9]*)$/;

/* istanbul ignore if: untestable */
if ( require.main === module ) {
  commandLine(process.argv.slice(2), console, process.exit);
}

/**
 * Executes Fate command-line parsing.  This function is normally
 * invoked automatically when the cli.js script is called directly.
 *
 * Example:
 *
 *     commandLine("-in", "./scripts", "-out", "./output");
 *
 * @param {String[]|Object} args arguments (passed from shell or as Object)
 * @param {Object} [console] A console object for output
 * @param {Function} [exitCallback] callback for exit code (no err)
 */
function commandLine(args, console, exitCallback) {
  /* istanbul ignore else: assumed to be an Object */
  if ( Array.isArray(args) ) {
    args = parseArguments(args);
  }

  var inDirs = getArrayArg('in');

  if ( args['help'] || !inDirs.length ) {
    displayUsage();
    exitCallback(0);
    return;
  }

  var skipWrite = getValueArg('parse') || false;
  var pattern = getValueArg('files') || '**/*.fate';
  var ext = getValueArg('ext') || '.js';
  var success = [];
  var errors = [];
  var warnings = [];

  try {
    // Iterate over the `-in` directories
    processDirectories();
    // Display the results
    processResults();
    if ( warnings.length ) {
      // If there are any warnings, display them
      processWarnings();
    }
    if ( errors.length ) {
      // If there are any errors, display them
      processErrors();
    }

    // Done!
    exitCallback(errors.length ? 1 : 0);
  }
  catch ( err ) {
    errorOut(err);
  }

  function processDirectories() {
    inDirs.forEach(processDirectory);
  }

  function processDirectory(inDir) {
    var outDir = getValueArg('out') || inDir;
    var files = glob.sync(pattern, { cwd: inDir });

    if ( !files.length ) {
      throw `No files found matching '${pattern}' in ${inDir}`;
    }

    files.forEach(function (file) {
      var inputPath = path.join(inDir, file);

      try {
        var compileResult = compileInputScript(inputPath);
        var compileWarnings = compileResult.err || [];

        compileWarnings.forEach(function (compileWarning) {
          warnings.push({ filePath: inputPath, err: compileWarning });
        });

        var scriptBody = compileResult.scriptBody;
        if ( !skipWrite ) {
          writeNodeModule(scriptBody, path.join(outDir, file + ext));
        }

        success.push({ filePath: inputPath });
      }
      catch ( err ) {
        errors.push({ filePath: inputPath, err: err });
      }
    });
  }

  function processResults() {
    console.info("Fate Parsing Complete");
    console.info("");
    if ( success.length ) {
      console.info("   Success: " + success.length);
    }
    if ( warnings.length ) {
      console.info("  Warnings: " + warnings.length);
    }
    if ( errors.length ) {
      console.info("  Failures: " + errors.length);
    }
    console.info("");
  }

  function processWarnings() {
    console.warn("Parser Warnings");
    console.warn("===============");
    warnings.forEach(displayCompilationError);
  }

  function processErrors() {
    console.warn("Parsing Errors");
    console.warn("==============");
    errors.forEach(displayCompilationError);
  }

  function displayCompilationError(error) {
    var wrapped = wrapCompileError(error.err, error.filePath);
    console.warn(wrapped.toString());
    console.warn("");
  }

  function getArrayArg(argName) {
    var val = args[argName];
    if ( Array.isArray(val) ) {
      return val;
    }
    return val !== null && val !== undefined ? [val] : [];
  }

  function getValueArg(argName) {
    var val = args[argName];
    if ( Array.isArray(val) ) {
      return val[0];
    }
    return val;
  }

  // Processing Functions

  function compileInputScript(inputPath) {
    var intContent = fs.readFileSync(inputPath).toString();
    return compileModule(intContent);
  }

  function writeNodeModule(jsContent, outputPath) {
    mkdirp.sync(path.dirname(outputPath));
    fs.writeFileSync(outputPath, generateNodeModule(jsContent));
  }

  // Support Functions

  function parseArguments(passedArguments) {
    var result = {};
    var argName = null;
    var argValue = null;

    passedArguments.forEach(function (arg) {
      var match = OptionRegex.exec(arg);

      if ( match ) {
        argName = match[1];
        argValue = true;
        result[argName] = argValue;
        return;
      }

      if ( Array.isArray(argValue) ) {
        argValue.push(arg);
        return;
      }

      if ( argValue === true ) {
        result[argName] = arg;
      }
      else {
        result[argName] = [argValue, arg];
      }
    });
    return result;
  }

  function errorOut(message) {
    displayUsage();
    console.error("Error!");
    console.error("");
    console.error("  " + message);
    console.error("");
    exitCallback(1);
  }

  function displayVersion() {
    console.info("Fate v" + VERSION);
    console.info("");
  }

  function displayUsage() {
    displayVersion();
    console.info("Usage:");
    console.info("");
    console.info("  fatec (options)");
    console.info("");
    console.info("Where:");
    console.info("");
    console.info("  Options:");
    console.info("");
    console.info("  -help          - You're looking at me right now");
    console.info("  -in <dirs>     - Locations of scripts to parse");
    console.info("  -parse         - Parse only! Don't generate any output");
    console.info("  -out <dir>     - Location of compiled output (or -in dir)");
    console.info("  -files <glob>  - Filename pattern to parse (or **/*.fate)");
    console.info("  -ext <ext>     - Filename extension to use (or .js)");
    console.info("");
  }
}

// Exported Functions
exports.commandLine = commandLine;
