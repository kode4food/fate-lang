/// <reference path="../Types.ts"/>
/// <reference path="../resolvers/Resolvers.ts"/>

namespace Fate.Runtime {
  type RuntimeInterface = any;

  // Register the default resolvers
  var systemResolver = Resolvers.createSystemResolver();
  var memoryResolver = Resolvers.createMemoryResolver();
  var _resolvers: Resolvers.Resolver[] = [systemResolver, memoryResolver];

  export var registerModule = memoryResolver.registerModule;
  export var unregisterModule = memoryResolver.unregisterModule;

  export function resolveExports(moduleName: string) {
    for ( var i = _resolvers.length - 1; i >= 0; i-- ) {
      var module = _resolvers[i].resolveExports(moduleName);
      if ( module ) {
        return module;
      }
    }
    return undefined;
  }

  export function resolveModule(moduleName: Types.ModulePath) {
    for ( var i = _resolvers.length - 1; i >= 0; i-- ) {
      var module = _resolvers[i].resolveModule(moduleName);
      if ( module ) {
        return module;
      }
    }
    return undefined;
  }

  export function resolvers(): Resolvers.Resolver[] {
    return _resolvers;
  }

  export function runtimeImport(methodName: string) {
    return (<RuntimeInterface>Runtime)[methodName];
  }

  // where exports are actually resolved. raiseError will be false
  // if we're in the process of evaluating a script for the purpose
  // of yielding its exports
  export function importer(moduleName: Types.ModulePath) {
    var module: Types.ModuleExports;

    return performImport;

    function performImport() {
      if ( module ) {
        return module;
      }

      module = resolveExports(moduleName);
      if ( !module ) {
        throw new Error("Module '" + moduleName + "' not resolved");
      }
      return module;
    }
  }
}
