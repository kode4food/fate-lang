/// <reference path="../Types.ts"/>
/// <reference path="../Fate.ts"/>

"use strict";

namespace Fate.Resolvers {
  import isFateModule = Types.isFateModule;
  import blessModule = Types.blessModule;

  type AnyMap = { [index: string]: any };

  interface CacheInfo {
    module: Types.Module;
    moduleExports?: Types.ModuleExports;
  }

  /**
   * Creates a new MemoryResolver.  As its name implies, this resolver
   * allows one to register a module to be stored in memory.  A default
   * instance of this resolver is used to store the System Modules.
   * Because of its flexibility, it can also be used to store custom
   * modules and native JavaScript helpers.
   */
  export function createMemoryResolver() {
    var cache: { [index: string]: CacheInfo } = {};

    var resolver = {
      resolveModule: resolveModule,
      resolveExports: resolveExports,
      unregisterModule: unregisterModule,
      registerModule: registerModule
    };

    return resolver;

    function resolveModule(name: Types.ModuleName) {
      var result = cache[name];
      return result ? result.module : undefined;
    }

    function resolveExports(name: Types.ModuleName) {
      var result = cache[name];
      if ( !result ) {
        return undefined;
      }

      if ( result.moduleExports ) {
        return result.moduleExports;
      }

      var moduleExports = result.moduleExports = result.module.exports();
      return moduleExports;
    }

    /**
     * Removes a module from the resolver cache.
     *
     * @param {String} name the name of the module to remove
     */
    function unregisterModule(name: Types.ModuleName) {
      delete cache[name];
    }

    /**
     * Registers a module in the module cache.
     *
     * @param {String} name the name of the module to be registered
     * @param {Function|String|Object} module the module to register
     */
    function registerModule(name: Types.ModuleName,
                            module: Types.Module|string|AnyMap) {
      // A compiled Fate Module function
      if ( isFateModule(module) ) {
        cache[name] = { module: <Types.Module>module };
        return;
      }

      // *String* - An unparsed Fate script
      if ( typeof module === 'string' ) {
        cache[name] = { module: Fate.compile(module) };
        return;
      }

      // *Object* - A hash of Helpers (name->Function)
      if ( typeof module === 'object' && module !== null &&
           !Array.isArray(module) ) {
        cache[name] = { module: createModuleStub(<AnyMap>module) };
        return;
      }

      throw new Error("Module not provided");
    }
  }

  /**
   * Takes a hash of Functions, blesses them, and creates a stub module for
   * them that can be returned by the `resolveModule()` call.
   *
   * @param {Object} moduleExports the hash of Functions to stub
   */
  function createModuleStub(moduleExports: AnyMap): Types.Module {
    return blessModule(scriptInterface, scriptExports);

    function scriptInterface() {
    }

    function scriptExports() {
      return moduleExports;
    }
  }
}
