/// <reference path="../../typings/pegjs/pegjs.d.ts"/>

/// <reference path="./Checker.ts"/>
/// <reference path="./Rewriter.ts"/>
/// <reference path="./CodeGen.ts"/>

"use strict";

namespace Fate.Compiler {
  var vm = require('vm');
  var generatedParser = require('./parser');
  var SyntaxError = generatedParser.SyntaxError;
  
  import checkSyntaxTree = Checker.checkSyntaxTree;
  import rewriteSyntaxTree = Rewriter.rewriteSyntaxTree;
  import generateScriptBody = CodeGen.generateScriptBody;

  export type ScriptContent = string;
  export type GeneratedCode = string;
  export type FilePath = string;

  export class CompileError implements Error {
    name: string = "CompileError";

    constructor(public message: string, public line: number,
                public column: number, public filePath?: FilePath) {}

    public toString() {
      return this.message;
    }
  }

  export type CompileErrors = CompileError[];

  export function compileModule(script: ScriptContent) {
    var warnings: CompileErrors = [];
    var parsed = generatedParser.parse(script);
    var checked = checkSyntaxTree(parsed, warnings);
    var rewritten = rewriteSyntaxTree(checked, warnings);

    return {
      scriptBody: generateScriptBody(rewritten),
      err: warnings
    };
  }

  export function generateNodeModule(generatedCode: GeneratedCode) {
    var buffer: string[] = [];
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
    var buffer: string[] = [];
    buffer.push('"use strict";');
    buffer.push(generatedCode);
    buffer.push("module.exports=s;");
    return buffer.join('');
  }

  export function generateFunction(generatedCode: GeneratedCode) {
    var context = vm.createContext({
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
    var lineInfo = ":" + err.line + ":" + err.column;
    var message = err.message;

    filePath = filePath || err.filePath || 'string';
    return filePath + lineInfo + ": " + message;
  }

  // Intercepts a PEG.js Exception and generate a human-readable error message
  function formatSyntaxError(err: PEG.SyntaxError,
                             filePath?: Compiler.FilePath): CompileError {
    var found = err.found;
    var line = err.line;
    var column = err.column;

    var unexpected = found ? "'" + found + "'" : "end of file";
    var errString = "Unexpected " + unexpected;
    var lineInfo = ":" + line + ":" + column;
    var message = (filePath || 'string') + lineInfo + ": " + errString;

    return new CompileError(message, line, column, filePath);
  }
}
