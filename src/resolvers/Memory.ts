"use strict";

import { compile, globals } from '../Fate';

import {
  isObject, Module, isFateModule, createModule, ModuleName, ModuleExports
} from '../Types';

type AnyMap = { [index: string]: any };

/*
 * Creates a new MemoryResolver.  As its name implies, this resolver
 * allows one to register a module to be stored in memory.  A default
 * instance of this resolver is used to store the System Modules.
 * Because of its flexibility, it can also be used to store custom
 * modules and native JavaScript helpers.
 */
export function createMemoryResolver() {
  let cache: { [index: string]: Module } = {};
  return { resolve, unregister, register };

  function resolve(name: ModuleName) {
    let result = cache[name];
    if ( !result ) {
      return undefined;
    }
    return result;
  }

  /*
   * Removes a module from the resolver cache.
   */
  function unregister(name: ModuleName) {
    delete cache[name];
  }

  /*
   * Registers a module in the module cache.
   */
  function register(name: ModuleName, module: string|AnyMap) {
    // A compiled Fate Module function
    if ( isFateModule(module) ) {
      cache[name] = <Module>module;
      return;
    }

    // *String* - An unparsed Fate script
    if ( typeof module === 'string' ) {
      let compiled = compile(module);
      let generatedModule = createModule();
      compiled(globals(), generatedModule.exports);
      cache[name] = generatedModule;
      return;
    }

    // *Object* - A hash of Helpers (name->Function)
    if ( isObject(module) ) {
      cache[name] = createModule(<ModuleExports>module);
      return;
    }

    throw new Error("Module not provided");
  }
}
