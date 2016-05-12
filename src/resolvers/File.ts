"use strict";

import { resolve as resolvePath } from 'path';

import { DirPath, createModule, Module, ModuleName } from '../Types';

interface Options {
  path: string;
}

const pathSuffixes = ['.fate', '/index.fate'];

/*
 * Creates a new FileResolver.
 */
export function createFileResolver(options: Options) {
  let cache: { [index: string]: Module } = {};
  let defaultBasePath: DirPath = options.path || process.cwd();
  return { resolve };

  function resolve(name: ModuleName, basePath = defaultBasePath) {
    let cacheKey = `${basePath}//${name}`;
    let result = cache[cacheKey];
    if ( result ) {
      return result;
    }

    result = loadFromFileSystem(name, basePath);
    if ( !result ) {
      return undefined;
    }
    cache[cacheKey] = result;
    return result;
  }
}

function loadFromFileSystem(name: ModuleName, basePath: DirPath) {
  let checkPaths = pathSuffixes.map(
    suffix => resolvePath(basePath, name + suffix)
  );

  for ( let i = 0; i < checkPaths.length; i++ ) {
    try {
      let moduleExports = require(checkPaths[i]);
      return createModule(moduleExports);
    }
    catch ( err ) {
      // no-op
    }
  }

  return undefined;
}
