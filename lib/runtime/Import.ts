/// <reference path="../Types.ts"/>
/// <reference path="../resolvers/Resolvers.ts"/>

namespace Fate.Runtime {
  import DirPath = Types.DirPath;
  import ModuleName = Types.ModuleName;

  type RuntimeInterface = any;

  // Register the default resolvers
  var fileResolver = Resolvers.createFileResolver({ path: process.cwd() });
  var systemResolver = Resolvers.createSystemResolver();
  var memoryResolver = Resolvers.createMemoryResolver();
  var _resolvers: Resolvers.Resolver[] = [
    fileResolver, systemResolver, memoryResolver
  ];

  export var registerModule = memoryResolver.register;
  export var unregisterModule = memoryResolver.unregister;

  export function resolve(moduleName: ModuleName, basePath?: DirPath) {
    for ( var i = _resolvers.length - 1; i >= 0; i-- ) {
      var module = _resolvers[i].resolve(moduleName, basePath);
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

    function performImport(basePath?: Types.DirPath) {
      var moduleExports = cache[basePath];
      if ( moduleExports ) {
        return moduleExports;
      }

      moduleExports = resolve(moduleName, basePath);
      if ( !moduleExports ) {
        throw new Error("Module '" + moduleName + "' not resolved");
      }
      cache[basePath] = moduleExports;
      return moduleExports;
    }
  }
}
