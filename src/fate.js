/** @flow */

import { readFileSync } from 'fs';
import { dirname } from 'path';

import type { ScriptContent } from './compiler';
import { compileModule, generateFunction } from './compiler';
import { isObject, mixin } from './runtime';

const pkg = require('../package.json');

export const VERSION = pkg.version;

export type DirPath = string;
export type ModuleName = string;

export type Module = {
  __fateModule?: boolean;
  result?: any;
  exports: ModuleExports;
}

export type ModuleExports = {
  [index: string]: any;
}

const DefaultGlobals = {
  __filename: undefined,
  __dirname: undefined,
};

/*
 * Fate compiler entry point.  Takes a script and returns a closure
 * for invoking it.  The script must be a String.
 */
export function compile(script: ScriptContent) {
  if (typeof script !== 'string') {
    throw new Error('script must be a string');
  }

  const compiledOutput = compileModule(script).scriptBody;
  return generateFunction(compiledOutput);
}

/*
 * Convenience function to compile and execute a script against a context
 * Object.  Not generally recommended.
 */
export function evaluate(script: ScriptContent, context?: {}) {
  const compiled = compile(script);
  const module = { exports: {} };
  return compiled(globals(context), module);
}

/*
 * Loads and immediately invokes the named script.  Any exported symbols will
 * be placed in the exports Object.
 */
export function runScript(filename: string, exports: {}) {
  const content = readFileSync(filename, 'utf8');
  const compiledOutput = compileModule(content).scriptBody;
  const generatedModule = generateFunction(compiledOutput);
  generatedModule(globals({ __filename: filename }), exports);
}

export function globals(extensions?: {}) {
  if (isObject(extensions)) {
    const result = Object.create(DefaultGlobals);
    mixin(result, extensions);
    if (!result.__dirname && result.__filename) {
      result.__dirname = dirname(result.__filename);
    }
    return result;
  }
  return DefaultGlobals;
}

export function createModule(moduleExports?: ModuleExports) {
  return {
    __fateModule: true,
    exports: moduleExports || {},
  };
}

export function isFateModule(module: any) {
  return (typeof module === 'function' || isObject(module))
    && module.__fateModule;
}

/*
 * Register the require() extension
 */
function fateRequireExtension(module: any, filename: string) {
  runScript(filename, module.exports);
}

require.extensions['.fate'] = fateRequireExtension;
