/** @flow */

import { createContext, runInContext } from 'vm';
import * as PEG from 'pegjs';

import * as Runtime from '../runtime';
import * as Target from './target';
import compilerPhases from './phase';

import { Visitor } from './syntax';

import { globals } from '../fate';

// eslint-disable-next-line import/no-unresolved
import generatedParser from './parser';

const { SyntaxError } = generatedParser;

export type ScriptContent = string;
export type FilePath = string;

export type CompileErrors = CompileError[];

export function compileModule(script: ScriptContent) {
  let syntaxTree = generatedParser.parse(script);

  const warnings: CompileErrors = [];
  const visitor = new Visitor(warnings);

  compilerPhases.forEach((createTreeProcessors) => {
    const processors = createTreeProcessors(visitor);

    processors.forEach((processor) => {
      syntaxTree = processor(syntaxTree);
    });
  });

  return {
    scriptBody: Target.generateScriptBody(syntaxTree),
    err: warnings,
  };
}

export function generateFunction(generatedCode: Target.GeneratedCode) {
  interface FateContext {
    g: any;
    r: any;
    module: any;
  }

  const context = createContext({
    g: globals(),
    r: Runtime,
    module: {},
  });

  runInContext(generateFunctionCode(generatedCode), context);
  return context.module.exports;
}

function generateFunctionCode(generatedCode: Target.GeneratedCode) {
  const buffer: string[] = [];
  buffer.push('"use strict";');
  buffer.push(generatedCode);
  buffer.push('module.exports=s;');
  return buffer.join('');
}

export class CompileError extends Error {
  name = 'CompileError';
  message: string;
  line: number;
  column: number;
  filePath: ?FilePath;

  constructor(message: string, line: number,
              column: number, filePath?: FilePath) {
    super();
    this.message = message;
    this.line = line;
    this.column = column;
    this.filePath = filePath;
  }

  toString() {
    return this.message;
  }
}

export function wrapCompileError(err: Error, filePath?: FilePath): Error {
  if (err instanceof CompileError) {
    if (filePath) {
      err.filePath = filePath;
    }
    err.message = formatCompileError(err, filePath);
    return err;
  }

  if (err instanceof SyntaxError) {
    return formatSyntaxError(err, filePath);
  }
  return err;
}

function formatCompileError(err: CompileError, filePath?: FilePath) {
  const lineInfo = `:${err.line}:${err.column}`;
  const { message } = err;

  filePath = filePath || err.filePath || 'string';
  return `${filePath}${lineInfo}: ${message}`;
}

// intercepts a PEG.js Exception and generate a human-readable error message
function formatSyntaxError(err: PEG.SyntaxError,
                           filePath?: FilePath): CompileError {
  const { found } = err;
  const { line, column } = err.location.start;

  const unexpected = found ? `'${found}'` : 'end of file';
  const errString = `Unexpected ${unexpected}`;
  const lineInfo = `:${line}:${column}`;

  const message = `${filePath || 'string'}${lineInfo}: ${errString}`;

  return new CompileError(message, line, column, filePath);
}
