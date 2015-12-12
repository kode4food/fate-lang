/// <reference path="../typings/tsd.d.ts" />

"use strict";

import minimist = require("minimist");

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { sync as glob } from 'glob';
import { sync as mkdirp } from 'mkdirp';

import {
  compileModule, generateNodeModule, wrapCompileError, CompileErrors
} from "./compiler/Compiler";

import { VERSION } from './Fate';

const ext = '.js';

interface CompilerOutput {
  filePath: string;
  err?: Error;
}

/**
 * Executes Fate command-line parsing.  This function is normally
 * invoked automatically when the cli.js script is called directly.
 *
 * Example:
 *
 *     commandLine("-in", "./scripts", "-out", "./output");
 */
export function commandLine(inputArgs: string[], console: Console,
                            exitCallback: Function) {
  let badArg = false;

  let args = minimist(inputArgs, {
    boolean: ['parse', 'help'],
    string: ['in', 'out', 'files'],
    unknown: () => { badArg = true; return false; }
  });

  let inDirs = makeArray(args['in']);

  if ( badArg || args['help'] || !inDirs.length ) {
    displayUsage();
    exitCallback(0);
    return;
  }

  let skipWrite = args['parse'];
  let pattern = args['files'] || '**/*.fate';
  let success: number = 0;
  let errors: CompilerOutput[] = [];
  let warnings: CompilerOutput[] = [];

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

  function processDirectory(inDir: string) {
    let outDir = args['out'] || inDir;
    let files = glob(pattern, { cwd: inDir });

    if ( !files.length ) {
      throw `No files found matching '${pattern}' in ${inDir}`;
    }

    files.forEach(function (file: string) {
      let inputPath = join(inDir, file);

      try {
        let compileResult = compileInputScript(inputPath);
        let compileWarnings = compileResult.err;

        compileWarnings.forEach(function (compileWarning) {
          warnings.push({ filePath: inputPath, err: compileWarning });
        });

        let scriptBody = compileResult.scriptBody;
        if ( !skipWrite ) {
          writeNodeModule(scriptBody, join(outDir, file + ext));
        }

        success += 1;
      }
      catch ( err ) {
        errors.push({ filePath: inputPath, err: err });
      }
    });
  }

  function processResults() {
    console.info("Fate Parsing Complete");
    console.info("");
    if ( success > 0 ) {
      console.info("   Success: " + success);
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

  function displayCompilationError(error: CompilerOutput) {
    let wrapped = wrapCompileError(error.err, error.filePath);
    console.warn(wrapped.toString());
    console.warn("");
  }

  function makeArray(value: string|string[]): string[] {
    if ( !Array.isArray(value) ) {
      return [value];
    }
    return <string[]>value;
  }

  // Processing Functions

  function compileInputScript(inputPath: string) {
    let intContent = readFileSync(inputPath).toString();
    return compileModule(intContent);
  }

  function writeNodeModule(jsContent: string, outputPath: string) {
    mkdirp(dirname(outputPath));
    writeFileSync(outputPath, generateNodeModule(jsContent));
  }

  // Support Functions

  function errorOut(message: string) {
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
    console.info("  --help         - You're looking at me right now");
    console.info("  --in <path>    - Location of scripts to parse");
    console.info("  --out <path>   - Location of compiled output (or -in dir)");
    console.info("  --files <glob> - Filename pattern to parse (or **/*.fate)");
    console.info("  --parse        - Parse only! Don't generate any output");
    console.info("");
  }
}
