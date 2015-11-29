/// <reference path="../Types.ts"/>
/// <reference path="../Fate.ts"/>

"use strict";

namespace Fate.Resolvers {
  import DirPath = Types.DirPath;

  let path = require('path');

  import createModule = Types.createModule;

  interface Options {
    path: string;
  }

  let explicitPathRegex = /(\.fate)(\.js)?$/;
  let pathSuffixes = ['.fate.js', '.fate', '/index.fate.js', '/index.fate'];

  /**
   * Creates a new FileResolver.
   *
   * @param {Options} [options] Options for generating the FileResolver
   * @param {String} [options.path] the base directory for resolving modules
   */
  export function createFileResolver(options: Options) {
    let cache: { [index: string]: Types.Module } = {};
    let defaultBasePath: DirPath = options.path || process.cwd();

    return {
      resolve: resolve
    };

    function resolve(name: Types.ModuleName, basePath = defaultBasePath) {
      let cacheKey = basePath + '//' + name;
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

  function loadFromFileSystem(name: Types.ModuleName, basePath: DirPath) {
    if ( explicitPathRegex.test(name) ) {
      try {
        let explicitPath = path.resolve(basePath, name);
        return createModule(require(explicitPath));
      }
      catch ( err ) {
        return undefined;
      }
    }

    let checkPaths = pathSuffixes.map(function (suffix) {
      return path.resolve(basePath, name + suffix);
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
}
