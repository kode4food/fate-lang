"use strict";

import { resolve as resolvePath } from 'path';

import { DirPath, createModule, Module, ModuleName } from '../Types';

interface Options {
  path: string;
}

const explicitPathRegex = /(\.fate)(\.js)?$/;
const pathSuffixes = ['.fate.js', '.fate', '/index.fate.js', '/index.fate'];

/**
  * Creates a new FileResolver.
  *
  * @param {Options} [options] Options for generating the FileResolver
  * @param {String} [options.path] the base directory for resolving modules
  */
export function createFileResolver(options: Options) {
  let cache: { [index: string]: Module } = {};
  let defaultBasePath: DirPath = options.path || process.cwd();

  return {
    resolve: resolve
  };

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
  if ( explicitPathRegex.test(name) ) {
    try {
      let explicitPath = resolvePath(basePath, name);
      return createModule(require(explicitPath));
    }
    catch ( err ) {
      return undefined;
    }
  }

  let checkPaths = pathSuffixes.map(function (suffix) {
    return resolvePath(basePath, name + suffix);
  });

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
