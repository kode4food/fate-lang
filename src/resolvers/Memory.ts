"use strict";

import * as Types from '../Types';

import { compile, globals } from '../Fate';

import isFateModule = Types.isFateModule;
import createModule = Types.createModule;

type AnyMap = { [index: string]: any };

/**
  * Creates a new MemoryResolver.  As its name implies, this resolver
  * allows one to register a module to be stored in memory.  A default
  * instance of this resolver is used to store the System Modules.
  * Because of its flexibility, it can also be used to store custom
  * modules and native JavaScript helpers.
  */
export function createMemoryResolver() {
  let cache: { [index: string]: Types.Module } = {};

  return {
    resolve: resolve,
    unregister: unregister,
    register: register
  };

  function resolve(name: Types.ModuleName) {
    let result = cache[name];
    if ( !result ) {
      return undefined;
    }
    return result;
  }

  /**
    * Removes a module from the resolver cache.
    *
    * @param {String} name the name of the module to remove
    */
  function unregister(name: Types.ModuleName) {
    delete cache[name];
  }

  /**
    * Registers a module in the module cache.
    *
    * @param {String} name the name of the module to be registered
    * @param {Function|String|Object} module the module to register
    */
  function register(name: Types.ModuleName, module: string|AnyMap) {
    // A compiled Fate Module function
    if ( isFateModule(module) ) {
      cache[name] = <Types.Module>module;
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
    if ( Types.isObject(module) ) {
      cache[name] = createModule(<Types.ModuleExports>module);
      return;
    }

    throw new Error("Module not provided");
  }
}
