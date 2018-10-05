/** @flow */

import { join, dirname } from 'path';
import { sync as glob } from 'glob';
import { sync as mkdirp } from 'mkdirp';
import minimist from 'minimist';

import {
  readFileSync, writeFileSync, unlinkSync, existsSync,
} from 'fs';

import type { GeneratedCode } from '../compiler/target';
import { compileModule, wrapCompileError } from '../compiler';
import { VERSION } from '../fate';

const defaultPattern = '*.fate';

export type CompilerArguments = {
  help: boolean;
  parse: boolean;
  clean: boolean;
  in: string;
  out: string;
  _: string[];
  console: Console;
}

type CompilerOutput = {
  filePath: string;
  err: Error;
}

type CompilerResults = {
  errors: CompilerOutput[];
  warnings: CompilerOutput[];
  success: number;
  deleted: number;
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

  const args = minimist(inputArgs, {
    boolean: ['parse', 'clean', 'help'],
    string: ['in', 'out'],
    unknown: (value) => {
      const invalidFlag = /^--.+/.test(value);
      badArg = badArg || invalidFlag;
      return !invalidFlag;
    },
  });

  if (!inputArgs.length || badArg || args.help) {
    displayUsage();
    completedCallback(badArg ? -1 : 0);
    return;
  }

  if ([args.clean, args.parse].reduce(flagCount, 0) > 1) {
    errorOut('Only one action can be performed at a time');
    return;
  }

  try {
    compile(args, processResults);
  } catch (err) {
    errorOut(err);
  }

  function processResults(err: any, results: CompilerResults) {
    const {
      errors, warnings, success, deleted,
    } = results;

    displayResults();
    displayWarnings();
    displayErrors();
    completedCallback(err ? -2 : 0);

    function displayResults() {
      console.info('Fate Compilation Complete');
      console.info('');

      if (success > 0) {
        console.info(`   Success: ${success}`);
      }
      if (args.clean) {
        console.info(`   Deleted: ${deleted}`);
      }
      if (warnings.length) {
        console.info(`  Warnings: ${warnings.length}`);
      }
      if (errors.length) {
        console.info(`  Failures: ${errors.length}`);
      }
      console.info('');
    }

    function displayWarnings() {
      if (warnings.length) {
        // If there are any warnings, display them
        console.warn('Compiler Warnings');
        console.warn('=================');
        warnings.forEach(displayCompilationError);
      }
    }

    function displayErrors() {
      if (errors.length) {
        // If there are any errors, display them
        console.warn('Compiler Errors');
        console.warn('===============');
        errors.forEach(displayCompilationError);
      }
    }

    function displayCompilationError(error: CompilerOutput) {
      const wrapped = wrapCompileError(error.err, error.filePath);
      console.warn(wrapped.toString());
      console.warn('');
    }
  }

  // Support Functions

  function flagCount(prev: number, value: boolean) {
    return prev + (value ? 1 : 0);
  }

  function errorOut(message: string) {
    displayUsage();
    console.error('Error!');
    console.error('');
    console.error(`  ${message}`);
    console.error('');

    completedCallback(1);
  }

  function displayVersion() {
    console.info(`Fate v${VERSION}`);
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
`,
    );
  }
}

export function compile(args: CompilerArguments, callback: Function) {
  const patterns = args._.length ? args._ : [defaultPattern];
  const errors: CompilerOutput[] = [];
  const warnings: CompilerOutput[] = [];
  let success = 0;
  let deleted = 0;

  // Process each pattern
  patterns.forEach(processPattern);

  // Done!
  callback(errors.length ? 'Errors Encountered' : null, {
    errors,
    warnings,
    success,
    deleted,
  });

  function processPattern(pattern: string) {
    const inDir = args.in || process.cwd();
    const outDir = args.out || inDir;
    const files = glob(pattern, { cwd: inDir });

    if (!files.length) {
      // eslint-disable-next-line no-throw-literal
      throw `No files found matching '${pattern}'`;
    }

    // Bleh, make this pretty
    const processor = args.parse ? (inputPath, _) => performParse(inputPath)
                                 : args.clean ? performClean : performCompile;

    files.forEach((file) => {
      const inputPath = join(inDir, file);
      const outputPath = join(outDir, file.replace(/\.fate$/, '.js'));

      try {
        processor(inputPath, outputPath);
      } catch (err) {
        errors.push({ filePath: inputPath, err });
      }
    });
  }

  function parseSource(inputPath: string) {
    const compileResult = compileInputScript(inputPath);
    const compileWarnings = compileResult.err;

    compileWarnings.forEach((compileWarning) => {
      warnings.push({ filePath: inputPath, err: compileWarning });
    });

    return compileResult.scriptBody;
  }

  function performParse(inputPath: string) {
    parseSource(inputPath);
    success += 1;
  }

  function performCompile(inputPath: string, outputPath: string) {
    writeNodeModule(parseSource(inputPath), outputPath);
    success += 1;
  }

  function performClean(inputPath: string, outputPath: string) {
    if (!existsSync(outputPath)) {
      return;
    }
    unlinkSync(outputPath);
    deleted += 1;
  }

  function compileInputScript(inputPath: string) {
    const intContent = readFileSync(inputPath).toString();
    return compileModule(intContent);
  }

  function writeNodeModule(jsContent: string, outputPath: string) {
    mkdirp(dirname(outputPath));
    writeFileSync(outputPath, generateNodeModule(jsContent));
  }
}

export function generateNodeModule(generatedCode: GeneratedCode) {
  const buffer: string[] = [];
  buffer.push('"use strict";');
  buffer.push(`"fate-compiler:${VERSION}";`);
  buffer.push("const fate=require('fatejs/dist/fate');");
  buffer.push("const r=require('fatejs/dist/runtime');");
  buffer.push(generatedCode);
  buffer.push('module.__fateModule=true;');
  buffer.push('module.result=s(');
  buffer.push('fate.globals({__filename}),');
  buffer.push('module.exports);');
  return buffer.join('');
}
