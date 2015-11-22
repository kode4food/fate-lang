/// <reference path="../../typings/pegjs/pegjs.d.ts"/>

/// <reference path="./Checker.ts"/>
/// <reference path="./Patterns.ts"/>
/// <reference path="./Rewriter.ts"/>
/// <reference path="./CodeGen.ts"/>

"use strict";

namespace Fate.Compiler {
  let vm = require('vm');
  let generatedParser = require('./parser');
  let SyntaxError = generatedParser.SyntaxError;

  import generateScriptBody = CodeGen.generateScriptBody;
  import Visitor = Compiler.Visitor;

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

  const compilerPipeline = [Checker, Patterns, Rewriter];

  export function compileModule(script: ScriptContent) {
    let syntaxTree = generatedParser.parse(script);

    let warnings: CompileErrors = [];
    let visitor = new Visitor(warnings);

    compilerPipeline.forEach(function (module) {
      let processors = module.createTreeProcessors(visitor);

      processors.forEach(function (processor) {
        syntaxTree = processor(syntaxTree);
      });
    });

    return {
      scriptBody: generateScriptBody(syntaxTree),
      err: warnings
    };
  }

  export function generateNodeModule(generatedCode: GeneratedCode) {
    let buffer: string[] = [];
    buffer.push('"use strict";');
    buffer.push("const fate=require('fatejs');");
    buffer.push("const r=fate.Runtime;");
    buffer.push(generatedCode);
    buffer.push("module.__fateModule=true;");
    buffer.push("module.result=s(");
    buffer.push("fate.globals({__filename}),");
    buffer.push("module.exports);");
    return buffer.join('');
  }

  export function generateFunctionCode(generatedCode: GeneratedCode) {
    let buffer: string[] = [];
    buffer.push('"use strict";');
    buffer.push(generatedCode);
    buffer.push("module.exports=s;");
    return buffer.join('');
  }

  export function generateFunction(generatedCode: GeneratedCode) {
    let context = vm.createContext({
      g: Fate.globals(),
      r: Runtime,
      module: { }
    });
    vm.runInContext(generateFunctionCode(generatedCode), context);
    return context.module.exports;
  }

  export function wrapCompileError(err: Error, filePath?: Compiler.FilePath) {
    if ( err instanceof CompileError ) {
      if ( filePath ) {
        err.filePath = filePath;
      }
      err.message = formatCompileError(err, filePath);
      return err;
    }

    if ( err instanceof SyntaxError ) {
      return formatSyntaxError(<PEG.SyntaxError>err, filePath);
    }

    return err;
  }

  function formatCompileError(err: CompileError,
                              filePath?: Compiler.FilePath) {
    let lineInfo = ":" + err.line + ":" + err.column;
    let message = err.message;

    filePath = filePath || err.filePath || 'string';
    return filePath + lineInfo + ": " + message;
  }

  // intercepts a PEG.js Exception and generate a human-readable error message
  function formatSyntaxError(err: PEG.SyntaxError,
                             filePath?: Compiler.FilePath): CompileError {
    let found = err.found;
    let line = err.line;
    let column = err.column;

    let unexpected = found ? "'" + found + "'" : "end of file";
    let errString = "Unexpected " + unexpected;
    let lineInfo = ":" + line + ":" + column;
    let message = (filePath || 'string') + lineInfo + ": " + errString;

    return new CompileError(message, line, column, filePath);
  }
}
