/// <reference path="../../typings/main.d.ts"/>

"use strict";

import * as Runtime from '../runtime';
import * as Target from './target';
import compilerPhases from './phase';

import { Visitor } from './syntax';

import { createContext, runInContext } from 'vm';
import { globals } from '../Fate';

const generatedParser = require('./parser');
const SyntaxError = generatedParser.SyntaxError;

export type ScriptContent = string;
export type FilePath = string;

export type CompileErrors = CompileError[];

export function compileModule(script: ScriptContent) {
  let syntaxTree = generatedParser.parse(script);

  let warnings: CompileErrors = [];
  let visitor = new Visitor(warnings);

  compilerPhases.forEach(createTreeProcessors => {
    let processors = createTreeProcessors(visitor);

    processors.forEach(processor => {
      syntaxTree = processor(syntaxTree);
    });
  });

  return {
    scriptBody: Target.generateScriptBody(syntaxTree),
    err: warnings
  };
}

export function generateFunction(generatedCode: Target.GeneratedCode) {
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

function generateFunctionCode(generatedCode: Target.GeneratedCode) {
  let buffer: string[] = [];
  buffer.push('"use strict";');
  buffer.push(generatedCode);
  buffer.push("module.exports=s;");
  return buffer.join('');
}

export class CompileError implements Error {
  public name: string = "CompileError";

  constructor(public message: string, public line: number,
              public column: number, public filePath?: FilePath) {}

  public toString() {
    return this.message;
  }
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
    console.log(err);
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
