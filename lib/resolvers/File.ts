/// <reference path="../compiler/Compiler.ts"/>
/// <reference path="../Types.ts"/>
/// <reference path="../Fate.ts"/>

"use strict";

namespace Fate.Resolvers {
  var fs = require('fs');
  var vm = require('vm');
  var path = require('path');

  import wrapCompileError = Compiler.wrapCompileError;
  import isFateModule = Types.isFateModule;

  type FilePath = string;

  interface Options {
    path: string,
  }

  interface CacheInfo {
    module: Types.Module;
    moduleExports?: Types.ModuleExports;
  }

  /**
   * Creates a new FileResolver.  This resolver is used by the Express View
   * Render engine to retrieve Fate Scripts and pre-compiled JavaScript
   * from disk.  To avoid a disk hit for every non-file request, you should
   * include this resolver at the beginning of a resolver list (since Fate
   * scans the resolvers from the end of the list).
   *
   * @param {Options} [options] Options for generating the FileResolver
   * @param {String} [options.path] the base directory for resolving modules
   * @param {boolean} [options.monitor] Monitor files for changes
   * @param {boolean} [options.compile] Parse raw scripts
   */
  export function createFileResolver(options: Options) {
    var cache: { [index: string]: CacheInfo } = {};
    var basePath = options.path || process.cwd();

    // All Resolvers must expose at least these two Functions
    var resolver = {
      resolveModule: resolveModule,
      resolveExports: resolveExports
    };

    return resolver;

    /**
     * Load (or Reload) the specified file if necessary.  The options will
     * be passed through to the Fate compiler, if necessary.
     *
     * @param {String} name the name of the file to check
     * @param {Object} options the Fate compiler options
     */
    function loadFromFileSystem(name: Types.ModuleName) {
      // Prefer to resolve a module by moduleName + extension
      var sourcePath = path.resolve(basePath, name + '.fate');
      var cached = cache[sourcePath];
      if ( cached ) {
        return cached;
      }

      var exists = statFile(sourcePath);
      if ( !exists ) {
        // Otherwise check a directory's `index.fate` file if there is one
        var modulePath = path.resolve(basePath, name);
        if ( statDirectory(modulePath) ) {
          sourcePath = path.resolve(basePath, name, 'index.fate');
          exists = statFile(sourcePath);
        }
      }

      if ( !exists ) {
        cached = cache[name] = { module: undefined };
        return cached;
      }

      try {
        var script = resolveFateModule(sourcePath);
        cached = cache[name] = { module: script };
        return cached;
      }
      catch ( err ) {
        throw wrapCompileError(err, name + '.fate');
      }
    }

    function resolveModule(name: Types.ModuleName) {
      // Only load the file in the case of a cache miss
      var result = cache[name];
      if ( result ) {
        return result.module;
      }

      result = loadFromFileSystem(name);
      return result.module;
    }

    function resolveExports(name: Types.ModuleName) {
      // Only process the exports in the case of a cache miss
      var result = cache[name];
      if ( !result || !result.module ) {
        result = loadFromFileSystem(name);
        if ( !result.module ) {
          return undefined;
        }
      }

      var moduleExports = result.moduleExports;
      if ( moduleExports ) {
        return moduleExports;
      }

      moduleExports = result.moduleExports = result.module.exports();
      return moduleExports;
    }

    function resolveFateModule(sourcePath: FilePath) {
      var content = fs.readFileSync(sourcePath).toString();
      return Fate.compile(content);
    }
  }

  function statFile(filePath: FilePath) {
    try {
      var stat = fs.statSync(filePath);
      return stat && stat.isFile() ? stat : null;
    }
    catch ( err ) {
      return undefined;
    }
  }

  function statDirectory(dirPath: FilePath) {
    try {
      var stat = fs.statSync(dirPath);
      return stat && stat.isDirectory() ? stat : undefined;
    }
    catch ( err ) {
      return undefined;
    }
  }
}
