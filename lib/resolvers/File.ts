/// <reference path="../Types.ts"/>
/// <reference path="../Fate.ts"/>

"use strict";

namespace Fate.Resolvers {
  import createModule = Types.createModule;

  var path = require('path');

  interface Options {
    path: string,
  }

  var pathSuffixes = ['.fate.js', '.fate', '/index.fate.js', '/index.fate'];

  /**
   * Creates a new FileResolver.
   *
   * @param {Options} [options] Options for generating the FileResolver
   * @param {String} [options.path] the base directory for resolving modules
   */
  export function createFileResolver(options: Options) {
    var cache: { [index: string]: Types.Module } = {};
    var basePath = options.path || process.cwd();

    return {
      resolve: resolve
    };

    function resolve(name: Types.ModuleName) {
      // Only process the exports in the case of a cache miss
      var result = cache[name];
      if ( result ) {
        return result;
      }

      result = loadFromFileSystem(name);
      if ( !result ) {
        return undefined;
      }
      cache[name] = result;
      return result;
    }

    function loadFromFileSystem(name: Types.ModuleName) {
      // Prefer to resolve a module by moduleName + extension
      var checkPaths = pathSuffixes.map(function (suffix) {
        return path.resolve(basePath, name + suffix);
      });

      for ( var i = 0; i < checkPaths.length; i++ ) {
        try {
          var moduleExports = require(checkPaths[i]);
          return createModule(moduleExports);
        }
        catch ( err ) {
        }
      }

      return undefined;
    }
  }
}
