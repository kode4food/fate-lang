/// <reference path="../typings/main.d.ts" />

"use strict";

import { readFileSync } from 'fs';
import { dirname } from 'path';

import { compileModule, generateFunction, ScriptContent } from './compiler';
import { isObject, mixin } from './runtime';

const pkg = require('../package.json');
export const VERSION = pkg.version;

import * as RuntimeExports from './runtime';
export let Runtime = RuntimeExports;

export type DirPath = string;
export type ModuleName = string;

export interface Module {
  __fateModule?: boolean;
  result?: any;
  exports: ModuleExports;
}

export interface ModuleExports {
  [index: string]: any;
}

type Globals = {
  [index: string]: any
  __filename: string,
  __dirname: string
};

const DefaultGlobals: Globals = {
  __filename: undefined,
  __dirname: undefined
};

/*
 * Fate compiler entry point.  Takes a script and returns a closure
 * for invoking it.  The script must be a String.
 */
export function compile(script: ScriptContent) {
  if ( typeof script !== 'string' ) {
    throw new Error("script must be a string");
  }

  let compiledOutput = compileModule(script).scriptBody;
  return generateFunction(compiledOutput);
}

/*
 * Convenience function to compile and execute a script against a context
 * Object.  Not generally recommended.
 */
export function evaluate(script: ScriptContent, context?: Object) {
  let compiled = compile(script);
  let module = { exports: {} };
  return compiled(globals(context), module);
}

/*
 * Loads and immediately invokes the named script.  Any exported symbols will
 * be placed in the exports Object.
 */
export function runScript(filename: string, exports: Object) {
  let content = readFileSync(filename, 'utf8');
  let compiledOutput = compileModule(content).scriptBody;
  let generatedModule = generateFunction(compiledOutput);
  generatedModule(globals({ __filename: filename }), exports);
}

export function globals(extensions?: Object) {
  if ( isObject(extensions) ) {
    let result = Object.create(DefaultGlobals);
    mixin(result, extensions);
    if ( !result.__dirname && result.__filename ) {
      result.__dirname = dirname(result.__filename);
    }
    return result;
  }
  return DefaultGlobals;
}

export function createModule(moduleExports?: ModuleExports) {
  return {
    __fateModule: true,
    exports: moduleExports || {}
  };
}

export function isFateModule(module: any) {
  return ( typeof module === 'function' || isObject(module) ) &&
    module.__fateModule;
}

/*
 * Register the require() extension
 */
function fateRequireExtension(module: any, filename: string) {
  runScript(filename, module.exports);
}

require.extensions['.fate'] = fateRequireExtension;
