/// <reference path="../Types.ts"/>
/// <reference path="../resolvers/Resolvers.ts"/>

namespace Fate.Runtime {
  import DirPath = Types.DirPath;
  import ModuleName = Types.ModuleName;

  // Register the default resolvers
  let nodeResolver = Resolvers.createNodeResolver();
  let fileResolver = Resolvers.createFileResolver({ path: process.cwd() });
  let systemResolver = Resolvers.createSystemResolver();
  let memoryResolver = Resolvers.createMemoryResolver();
  let _resolvers: Resolvers.Resolver[] = [
    nodeResolver, fileResolver, systemResolver, memoryResolver
  ];

  export let registerModule = memoryResolver.register;
  export let unregisterModule = memoryResolver.unregister;

  export function resolve(moduleName: ModuleName, basePath?: DirPath) {
    for ( let i = _resolvers.length - 1; i >= 0; i-- ) {
      let module = _resolvers[i].resolve(moduleName, basePath);
      if ( module ) {
        return module.exports;
      }
    }
    return undefined;
  }

  export function resolvers(): Resolvers.Resolver[] {
    return _resolvers;
  }

  export function importer(moduleName: ModuleName) {
    let cache: { [index: string]: Types.ModuleExports } = {};
    return performImport;

    function performImport(basePath?: Types.DirPath) {
      let moduleExports = cache[basePath];
      if ( moduleExports ) {
        return moduleExports;
      }

      moduleExports = resolve(moduleName, basePath);
      if ( !moduleExports ) {
        throw new Error(`Module '${moduleName}' not resolved`);
      }
      cache[basePath] = moduleExports;
      return moduleExports;
    }
  }
}
