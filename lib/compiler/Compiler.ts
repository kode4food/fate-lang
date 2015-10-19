/// <reference path="./Rewriter.ts"/>
/// <reference path="./CodeGen.ts"/>

"use strict";

namespace Fate.Compiler {
  var vm = require('vm');
  var generatedParser = require('./parser');
  var SyntaxError = generatedParser.SyntaxError;

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
    var rewritten = rewriteSyntaxTree(parsed, warnings);

    return {
      scriptBody: generateScriptBody(rewritten),
      err: warnings
    };
  }

  export function generateNodeModule(generatedCode: GeneratedCode) {
    var buffer: string[] = [];
    buffer.push("\"use strict\";");
    buffer.push("var fate=require('fatejs');");
    buffer.push("(function(g,r,module){");
    buffer.push(generateFunctionCode(generatedCode));
    buffer.push("}(fate.global,fate.Runtime,module));");
    buffer.push("if(require.main===module){");
    buffer.push("module.exports();");
    buffer.push("}");
    return buffer.join('');
  }

  export function generateFunctionCode(generatedCode: GeneratedCode) {
    var buffer: string[] = [];
    buffer.push("\"use strict\";");
    buffer.push("var x;");
    buffer.push("module.exports=w;");
    buffer.push("w.exports=function(){");
    buffer.push("if(!x){x={};s(g,x);}");
    buffer.push("return x;");
    buffer.push("};");
    buffer.push("w.__fateFunction=w.__fateModule=true;");
    buffer.push(generatedCode);
    buffer.push("function w(c){return s(c||g,{});}");
    return buffer.join('');
  }

  export function generateFunction(generatedCode: GeneratedCode) {
    var context = vm.createContext({
      g: Fate.global,
      r: Runtime,
      module: { exports: {} }
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
      return formatSyntaxError(err, filePath);
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

  interface PegError {
    found: string;
    line: number;
    column: number;
  }

  // Intercepts a PEG.js Exception and generate a human-readable error message
  function formatSyntaxError(err: SyntaxError,
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
