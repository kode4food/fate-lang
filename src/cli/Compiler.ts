/// <reference path="../../typings/tsd.d.ts" />

"use strict";

import minimist = require("minimist");

import { join, dirname } from 'path';
import { sync as glob } from 'glob';
import { sync as mkdirp } from 'mkdirp';

import {
  readFileSync, writeFileSync, unlinkSync, existsSync
} from 'fs';

import {
  compileModule, wrapCompileError, GeneratedCode
} from "../compiler/Compiler";

import { VERSION } from '../Fate';

const defaultPattern = '*.fate';

export interface CompilerArguments {
  'help'?: boolean;
  'parse'?: boolean;
  'clean'?: boolean;
  'in'?: string;
  'out'?: string;
  '_'?: string[];
  console?: Console;
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

  let args = <CompilerArguments>minimist(inputArgs, {
    boolean: ['parse', 'clean', 'help'],
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

  if ( [args.clean, args.parse].reduce(flagCount, 0) > 1 ) {
    errorOut("Only one action can be performed at a time");
    return;
  }

  try {
    compile(args, completedCallback, console);
  }
  catch ( err ) {
    errorOut(err);
  }

  // Support Functions

  function flagCount(prev: number, value: boolean) {
    return prev + (value ? 1 : 0);
  }

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
    --in <path>    - Location of source files to compile
    --out <path>   - Location of compiled output (--in)
    --parse        - Parse only! Don't generate any output
    --clean        - Delete any compiled output

    <patterns>     - Filename patterns to parse (*.fate)
`
    );
  }
}

export function compile(args: CompilerArguments,
                        completedCallback: Function,
                        output = console) {
  let patterns = args._.length ? args._ : [defaultPattern];
  let errors: CompilerOutput[] = [];
  let warnings: CompilerOutput[] = [];
  let success = 0;
  let deleted = 0;

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

  function processPattern(pattern: string) {
    let inDir = args.in || process.cwd();
    let outDir = args.out || inDir;
    let files = glob(pattern, { cwd: inDir });

    if ( !files.length ) {
      throw `No files found matching '${pattern}'`;
    }

    // Bleh, make this pretty
    let processor = args.parse ? performParse :
                    args.clean ? performClean :
                                 performCompile;

    files.forEach(function (file) {
      let inputPath = join(inDir, file);
      let outputPath = join(outDir, file.replace(/\.fate$/, '.js'));

      try {
        processor(inputPath, outputPath);
      }
      catch ( err ) {
        errors.push({ filePath: inputPath, err: err });
      }
    });
  }

  function parseSource(inputPath: string) {
    let compileResult = compileInputScript(inputPath);
    let compileWarnings = compileResult.err;

    compileWarnings.forEach(function (compileWarning) {
      warnings.push({ filePath: inputPath, err: compileWarning });
    });

    return compileResult.scriptBody;
  }

  function performParse(inputPath: string) {
    parseSource(inputPath);
    success++;
  }

  function performCompile(inputPath: string, outputPath: string) {
    writeNodeModule(parseSource(inputPath), outputPath);
    success++;
  }

  function performClean(inputPath: string, outputPath: string) {
    if ( !existsSync(outputPath) ) {
      return;
    }
    unlinkSync(outputPath);
    deleted++;
  }

  function processResults() {
    output.info("Fate Parsing Complete");
    output.info("");

    if ( success > 0 ) {
      output.info("   Success: " + success);
    }
    if ( args.clean ) {
      output.info("   Deleted: " + deleted);
    }
    if ( warnings.length ) {
      output.info("  Warnings: " + warnings.length);
    }
    if ( errors.length ) {
      output.info("  Failures: " + errors.length);
    }
    output.info("");
  }

  function processWarnings() {
    output.warn("Parser Warnings");
    output.warn("===============");
    warnings.forEach(displayCompilationError);
  }

  function processErrors() {
    output.warn("Parsing Errors");
    output.warn("==============");
    errors.forEach(displayCompilationError);
  }

  function displayCompilationError(error: CompilerOutput) {
    let wrapped = wrapCompileError(error.err, error.filePath);
    output.warn(wrapped.toString());
    output.warn("");
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
    buffer.push(`"fate-compiler:${VERSION}";`);
    buffer.push("const fate=require('fatejs');");
    buffer.push("const r=fate.Runtime;");
    buffer.push(generatedCode);
    buffer.push("module.__fateModule=true;");
    buffer.push("module.result=s(");
    buffer.push("fate.globals({__filename}),");
    buffer.push("module.exports);");
    return buffer.join('');
  }
}

