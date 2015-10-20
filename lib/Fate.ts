/// <reference path="./Util.ts"/>
/// <reference path="./Runtime.ts"/>
/// <reference path="./compiler/Compiler.ts"/>

"use strict";

namespace Fate {
  var fs = require('fs');

  import compileModule = Compiler.compileModule;
  import generateFunction = Compiler.generateFunction;

  var pkg = require('../package.json');
  export var VERSION = pkg.version;

  export var global = {
    console: console,
    require: require,
    setTimeout: setTimeout
  };

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

    var compiledOutput = compileModule(script).scriptBody;
    return generateFunction(compiledOutput);
  }

  /**
   * Convenience function to compile and execute a script against a context
   * Object.  Not generally recommended.
   */
  export function evaluate(script: Compiler.ScriptContent, context?: Object) {
    var compiled = compile(script);
    var module = { exports: {} };
    return compiled(context || Fate.global, module);
  }

  /**
   * Register the require() extension
   */
  require.extensions['.fate'] = fateRequireExtension;

  function fateRequireExtension(module: any, filename: string) {
    var content = fs.readFileSync(filename, 'utf8');
    var compiledOutput = compileModule(content).scriptBody;
    var generatedModule = generateFunction(compiledOutput);
    generatedModule(global, module.exports);
  }
}
