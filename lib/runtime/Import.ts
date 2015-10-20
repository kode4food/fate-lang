/// <reference path="../Types.ts"/>
/// <reference path="../resolvers/Resolvers.ts"/>

namespace Fate.Runtime {
  type RuntimeInterface = any;

  // Register the default resolvers
  var systemResolver = Resolvers.createSystemResolver();
  var memoryResolver = Resolvers.createMemoryResolver();
  var _resolvers: Resolvers.Resolver[] = [systemResolver, memoryResolver];

  export var registerModule = memoryResolver.register;
  export var unregisterModule = memoryResolver.unregister;

  export function resolve(moduleName: string) {
    for ( var i = _resolvers.length - 1; i >= 0; i-- ) {
      var module = _resolvers[i].resolve(moduleName);
      if ( module ) {
        return module.exports;
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
    var moduleExports: Types.ModuleExports;

    return performImport;

    function performImport() {
      if ( moduleExports ) {
        return moduleExports;
      }

      moduleExports = resolve(moduleName);
      if ( !moduleExports ) {
        throw new Error("Module '" + moduleName + "' not resolved");
      }
      return moduleExports;
    }
  }
}
