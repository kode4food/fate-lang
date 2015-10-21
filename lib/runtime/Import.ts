/// <reference path="../Types.ts"/>
/// <reference path="../resolvers/Resolvers.ts"/>

namespace Fate.Runtime {
  import DirPath = Types.DirPath;
  import ModuleName = Types.ModuleName;

  type RuntimeInterface = any;

  // Register the default resolvers
  var systemResolver = Resolvers.createSystemResolver();
  var memoryResolver = Resolvers.createMemoryResolver();
  var _resolvers: Resolvers.Resolver[] = [systemResolver, memoryResolver];

  export var registerModule = memoryResolver.register;
  export var unregisterModule = memoryResolver.unregister;

  export function resolve(moduleName: ModuleName, baseDir?: DirPath) {
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

  export function importer(moduleName: ModuleName) {
    var cache: { [index: string]: Types.ModuleExports } = {};
    return performImport;

    function performImport(baseDir?: Types.DirPath) {
      var moduleExports = cache[baseDir];
      if ( moduleExports ) {
        return moduleExports;
      }

      moduleExports = resolve(moduleName, baseDir);
      if ( !moduleExports ) {
        throw new Error("Module '" + moduleName + "' not resolved");
      }
      cache[baseDir] = moduleExports;
      return moduleExports;
    }
  }
}
