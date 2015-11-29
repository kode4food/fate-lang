/// <reference path="./Util.ts"/>
/// <reference path="./Types.ts"/>
/// <reference path="./Runtime.ts"/>
/// <reference path="./Global.ts"/>

/// <reference path="./compiler/Compiler.ts"/>

"use strict";

namespace Fate {
  let fs = require('fs');
  let path = require('path');

  import compileModule = Compiler.compileModule;
  import generateFunction = Compiler.generateFunction;

  let pkg = require('../package.json');
  export var VERSION = pkg.version;

  export function globals(extensions?: Object) {
    if ( Types.isObject(extensions) ) {
      let result = Object.create(Global);
      Util.mixin(result, extensions);
      if ( !result.__dirname && result.__filename ) {
        result.__dirname = path.dirname(result.__filename);
      }
      return result;
    }
    return Global;
  }

  /**
   * Fate compiler entry point.  Takes a script and returns a closure
   * for rendering it.  The script must be a String.
   *
   * @param {String} script the script to be compiled
   */
  export function compile(script: Compiler.ScriptContent) {
    if ( typeof script !== 'string' ) {
      throw new Error("script must be a string");
    }

    let compiledOutput = compileModule(script).scriptBody;
    return generateFunction(compiledOutput);
  }

  /**
   * Convenience function to compile and execute a script against a context
   * Object.  Not generally recommended.
   */
  export function evaluate(script: Compiler.ScriptContent, context?: Object) {
    let compiled = compile(script);
    let module = { exports: {} };
    return compiled(globals(context), module);
  }

  /**
   * Register the require() extension
   */
  require.extensions['.fate'] = fateRequireExtension;

  function fateRequireExtension(module: any, filename: string) {
    let content = fs.readFileSync(filename, 'utf8');
    let compiledOutput = compileModule(content).scriptBody;
    let generatedModule = generateFunction(compiledOutput);
    generatedModule(globals({ __filename: filename }), module.exports);
  }
}
