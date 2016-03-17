/// <reference path="../../typings/tsd.d.ts" />

"use strict";

import minimist = require("minimist");

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { sync as glob } from 'glob';
import { sync as mkdirp } from 'mkdirp';

import {
  compileModule, generateNodeModule, wrapCompileError
} from "../compiler/Compiler";

import { VERSION } from '../Fate';

const ext = '.js';

interface ParsedArguments {
  'help'?: boolean;
  'parse'?: boolean;
  'in'?: string|string[];
  'out'?: string;
  'files'?: string;
}

interface CompilerOutput {
  filePath: string;
  err?: Error;
}

/*
 * Executes Fate command-line parsing.  This function is normally
 * invoked automatically when the cli.js script is called directly.
 *
 * Example:
 *
 *     commandLine("-in", "./scripts", "-out", "./output");
 */
export function commandLine(inputArgs: string[], console: Console,
                            completedCallback: Function) {
  let badArg = false;

  let args = <ParsedArguments>minimist(inputArgs, {
    boolean: ['parse', 'help'],
    string: ['in', 'out', 'files'],
    unknown: () => { badArg = true; return false; }
  });

  if ( !inputArgs.length || badArg || args.help ) {
    displayUsage();
    completedCallback(badArg ? -1 : 0);
    return;
  }

  let inDirs = makeArray(args.in);
  let skipWrite = args.parse;
  let pattern = args.files || '**/*.fate';
  let errors: CompilerOutput[] = [];
  let warnings: CompilerOutput[] = [];
  let success = 0;

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
    completedCallback(errors.length ? -2 : 0);
  }
  catch ( err ) {
    errorOut(err);
  }

  function processDirectories() {
    inDirs.forEach(processDirectory);
  }

  function processDirectory(inDir: string) {
    let outDir = args.out || inDir;
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

    completedCallback(1);
  }

  function displayVersion() {
    console.info("Fate v" + VERSION);
  }

  function displayUsage() {
    displayVersion();
    console.info(
`
  Usage:

    fatec (options)

  Where:

    Options:

    --help         - You're looking at me right now
    --in <path>    - Location of scripts to parse
    --out <path>   - Location of compiled output (or --in path)
    --files <glob> - Filename pattern to parse (**/*.fate)
    --parse        - Parse only! Don't generate any output
`
    );
  }
}
