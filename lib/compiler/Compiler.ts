/// <reference path="./Rewriter.ts"/>
/// <reference path="./CodeGen.ts"/>

"use strict";

namespace Fate.Compiler {
  var vm = require('vm');
  var generatedParser = require('./parser');

  import rewriteSyntaxTree = Rewriter.rewriteSyntaxTree;
  import generateScriptBody = CodeGen.generateScriptBody;

  export type ScriptContent = string;
  export type GeneratedCode = string;
  export type FilePath = string;

  export interface Warning {
    line: number;
    column: number;
    message: string;
    filePath?: FilePath;
  }

  export type Warnings = Warning[];

  export function compileModule(script: ScriptContent) {
    var warnings: Warnings = [];
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
    buffer.push("var fate=require('fate');");
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

  // Intercepts a PEG.js Exception and generate a human-readable error message
  export function formatSyntaxError(err: Error, filePath?: Compiler.FilePath) {
    if ( !err.name || err.name !== 'SyntaxError' ) {
      return err;
    }

    var unexpected = err.found ? "'" + err.found + "'" : "end of file";
    var errString = "Unexpected " + unexpected;
    var lineInfo = ":" + err.line + ":" + err.column;

    return new Error((filePath || 'string') + lineInfo + ": " + errString);
  }

  export function formatWarning(warning: Warning,
                                filePath?: Compiler.FilePath) {
    var lineInfo = ":" + warning.line + ":" + warning.column;
    var warningString = warning.message;

    filePath = filePath || warning.filePath || 'string';
    return filePath + lineInfo + ": " + warningString;
  }
}
