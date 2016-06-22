/// <reference path="../../typings/tsd.d.ts"/>

"use strict";

import Visitor from './Visitor';
import Prepare from './Prepare';
import Patterns from './Patterns';
import Rewrite from './Rewrite';
import Validate from './Validate';

import * as Runtime from '../Runtime';

import { createContext, runInContext } from 'vm';
import { generateScriptBody } from './CodeGen';
import { globals } from '../Fate';

const generatedParser = require('./parser');
const SyntaxError = generatedParser.SyntaxError;

export type ScriptContent = string;
export type GeneratedCode = string;
export type FilePath = string;

export class CompileError implements Error {
  public name: string = "CompileError";

  constructor(public message: string, public line: number,
              public column: number, public filePath?: FilePath) {}

  public toString() {
    return this.message;
  }
}

export type CompileErrors = CompileError[];

const compilerPipeline = [Prepare, Patterns, Rewrite, Validate];

export function compileModule(script: ScriptContent) {
  let syntaxTree = generatedParser.parse(script);

  let warnings: CompileErrors = [];
  let visitor = new Visitor(warnings);

  compilerPipeline.forEach(createTreeProcessors => {
    let processors = createTreeProcessors(visitor);

    processors.forEach(processor => {
      syntaxTree = processor(syntaxTree);
    });
  });

  return {
    scriptBody: generateScriptBody(syntaxTree),
    err: warnings
  };
}

export function generateFunction(generatedCode: GeneratedCode) {
  interface FateContext {
    g: any;
    r: any;
    module: any;
  }

  let context = <FateContext>createContext({
    g: globals(),
    r: Runtime,
    module: {}
  });

  runInContext(generateFunctionCode(generatedCode), context);
  return context.module.exports;
}

function generateFunctionCode(generatedCode: GeneratedCode) {
  let buffer: string[] = [];
  buffer.push('"use strict";');
  buffer.push(generatedCode);
  buffer.push("module.exports=s;");
  return buffer.join('');
}

export function wrapCompileError(err: Error, filePath?: FilePath): Error {
  if ( err instanceof CompileError ) {
    /* istanbul ignore else: there isn't one */
    if ( filePath ) {
      err.filePath = filePath;
    }
    err.message = formatCompileError(err, filePath);
    return err;
  }

  /* istanbul ignore else: CompileError and SyntaxError are all we have */
  if ( err instanceof SyntaxError ) {
    return formatSyntaxError(<PEG.SyntaxError>err, filePath);
  }
  else {
    return err;
  }
}

function formatCompileError(err: CompileError, filePath?: FilePath) {
  let lineInfo = `:${err.line}:${err.column}`;
  let message = err.message;

  /* istanbul ignore next: string fallback logic */
  filePath = filePath || err.filePath || 'string';
  return `${filePath}${lineInfo}: ${message}`;
}

// intercepts a PEG.js Exception and generate a human-readable error message
function formatSyntaxError(err: PEG.SyntaxError,
                           filePath?: FilePath): CompileError {
  let found = err.found;
  let line = err.location.start.line;
  let column = err.location.start.column;

  /* istanbul ignore next: string fallback logic */
  let unexpected = found ? `'${found}'` : "end of file";
  let errString = `Unexpected ${unexpected}`;
  let lineInfo = `:${line}:${column}`;

  /* istanbul ignore next: string fallback logic */
  let message = `${filePath || 'string'}${lineInfo}: ${errString}`;

  return new CompileError(message, line, column, filePath);
}
