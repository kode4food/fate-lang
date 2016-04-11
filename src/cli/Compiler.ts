/// <reference path="../../typings/tsd.d.ts" />

"use strict";

import minimist = require("minimist");

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { sync as glob } from 'glob';
import { sync as mkdirp } from 'mkdirp';

import {
  compileModule, wrapCompileError, GeneratedCode
} from "../compiler/Compiler";

import { VERSION } from '../Fate';

const defaultPattern = '*.fate';

interface ParsedArguments {
  'help'?: boolean;
  'parse'?: boolean;
  'in'?: string;
  'out'?: string;
  '_'?: string[];
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
 *     commandLine("--in", "./scripts", "--out", "./output");
 */
export function commandLine(inputArgs: string[], console: Console,
                            completedCallback: Function) {
  let badArg = false;

  let args = <ParsedArguments>minimist(inputArgs, {
    boolean: ['parse', 'help'],
    string: ['in', 'out'],
    unknown: (value) => {
      let invalidFlag = /^--.+/.test(value);
      badArg = badArg || invalidFlag;
      return !invalidFlag;
    }
  });

  if ( !inputArgs.length || badArg || args.help ) {
    displayUsage();
    completedCallback(badArg ? -1 : 0);
    return;
  }

  let skipWrite = args.parse;
  let patterns = args._.length ? args._ : [defaultPattern];
  let errors: CompilerOutput[] = [];
  let warnings: CompilerOutput[] = [];
  let success = 0;

  try {
    // Process each pattern
    patterns.forEach(processPattern);
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

  function processPattern(pattern: string) {
    let inDir = args.in || process.cwd();
    let outDir = args.out || inDir;
    let files = glob(pattern, { cwd: inDir });

    if ( !files.length ) {
      throw `No files found matching '${pattern}'`;
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
          let outFile = file.replace(/\.fate$/, '.js');
          writeNodeModule(scriptBody, join(outDir, outFile));
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

  // Processing Functions

  function compileInputScript(inputPath: string) {
    let intContent = readFileSync(inputPath).toString();
    return compileModule(intContent);
  }

  function writeNodeModule(jsContent: string, outputPath: string) {
    mkdirp(dirname(outputPath));
    writeFileSync(outputPath, generateNodeModule(jsContent));
  }

  function generateNodeModule(generatedCode: GeneratedCode) {
    let buffer: string[] = [];
    buffer.push('"use strict";');
    buffer.push('"use fate";');
    buffer.push("const fate=require('fatejs');");
    buffer.push("const r=fate.Runtime;");
    buffer.push(generatedCode);
    buffer.push("module.__fateModule=true;");
    buffer.push("module.result=s(");
    buffer.push("fate.globals({__filename}),");
    buffer.push("module.exports);");
    return buffer.join('');
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

    fatec (options) <patterns>

  Where:

    Options:

    --help         - You're looking at me right now
    --parse        - Parse only! Don't generate any output
    --in <path>    - Location of source files to compile
    --out <path>   - Location of compiled output (--in)

    <patterns>     - Filename patterns to parse (*.fate)
`
    );
  }
}
