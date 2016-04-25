"use strict";

import * as Resolvers from '../resolvers';

import { DirPath, ModuleName, ModuleExports } from '../Types';

// Register the default resolvers
const nodeResolver = Resolvers.createNodeResolver();
const fileResolver = Resolvers.createFileResolver({ path: process.cwd() });
const systemResolver = Resolvers.createSystemResolver();
const memoryResolver = Resolvers.createMemoryResolver();

const _resolvers: Resolvers.Resolver[] = [
  fileResolver, nodeResolver, systemResolver, memoryResolver
];

export const registerModule = memoryResolver.register;
export const unregisterModule = memoryResolver.unregister;

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
  let cache: { [index: string]: ModuleExports } = {};
  return performImport;

  function performImport(basePath?: DirPath) {
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
