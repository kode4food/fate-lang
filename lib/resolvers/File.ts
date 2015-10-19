/// <reference path="../../typings/node/node.d.ts"/>
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
    monitor: boolean,
    compile: boolean
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
    var monitor = options.monitor;
    var checkFileStatus = createFileStatusChecker();
    var resolveScript = options.compile ? resolveFate : resolveJS;
    var ext = options.compile ? '.fate' : '.fate.js';

    // All Resolvers must expose at least these two Functions
    var resolver = {
      resolveModule: monitor ? resolveMonitoredModule : resolveCachedModule,
      resolveExports: monitor ? resolveMonitoredExports : resolveCachedExports
    };

    return resolver;

    /**
     * Load (or Reload) the specified file if necessary.  The options will
     * be passed through to the Fate compiler, if necessary.
     *
     * @param {String} name the name of the file to check
     * @param {Object} options the Fate compiler options
     */
    function reloadIfNeeded(name: Types.ModuleName) {
      // Prefer to resolve a module by moduleName + extension
      var sourcePath = path.resolve(basePath, name + ext);
      var statusResult = checkFileStatus(sourcePath);
      var cached: CacheInfo;

      if ( !statusResult.exists ) {
        // Otherwise check a directory's `index.jq` file if there is one
        var modulePath = path.resolve(basePath, name);
        if ( statDirectory(modulePath) ) {
          sourcePath = path.resolve(basePath, name, 'index' + ext);
          statusResult = checkFileStatus(sourcePath);
        }
      }

      if ( !statusResult.exists ) {
        cached = cache[name] = { module: undefined };
        return cached;
      }

      if ( statusResult.dirty ) {
        try {
          var script = resolveScript(sourcePath);
          cached = cache[name] = { module: script };
          return cached;
        }
        catch ( err ) {
          throw wrapCompileError(err, name + ext);
        }
      }

      cached = cache[name];
      if ( !cached ) {
        cached = cache[name] = { module: undefined };
      }
      return cached;
    }

    function resolveMonitoredModule(name: Types.ModuleName) {
      // Always attempt to reload the file if necessary
      var result = reloadIfNeeded(name);
      return result.module;
    }

    function resolveCachedModule(name: Types.ModuleName) {
      // Only load the file in the case of a cache miss
      var result = cache[name];
      if ( result ) {
        return result.module;
      }

      result = reloadIfNeeded(name);
      return result.module;
    }

    function resolveMonitoredExports(name: Types.ModuleName) {
      // Always attempt to re-process the exports if necessary
      var result = reloadIfNeeded(name);
      if ( !result.module ) {
        return undefined;
      }

      var moduleExports = result.moduleExports;
      if ( moduleExports ) {
        return moduleExports;
      }

      moduleExports = result.moduleExports = result.module.exports();
      return moduleExports;
    }

    function resolveCachedExports(name: Types.ModuleName) {
      // Only process the exports in the case of a cache miss
      var result = cache[name];
      if ( !result || !result.module ) {
        result = reloadIfNeeded(name);
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

    function resolveFate(sourcePath: FilePath) {
      var content = fs.readFileSync(sourcePath).toString();
      return Fate.compile(content);
    }

    function resolveJS(sourcePath: FilePath) {
      var content = fs.readFileSync(sourcePath).toString();

      var context = vm.createContext({
        require: require,
        module: { exports: {} }
      });
      vm.runInContext(content, context, sourcePath);

      var script = context.module.exports;
      if ( !isFateModule(script) ) {
        throw new Error("Module is not a Fate Script: " + sourcePath);
      }
      return script;
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

  enum FileStatus {
    notModified = 0,
    notFound = 1,
    deleted = 2,
    newFile = 3,
    modified = 4
  }

  interface StatusCheckResult {
    status: FileStatus;
    exists: boolean;
    stats?: Object;
    dirty?: boolean;
  }

  /**
   * Creates a cache of file modification timestamps in order to check
   * whether or not a file has been modified since last requested.  This
   * interface introduces a performance hit for script processing, and
   * is only used when the File Resolver's `monitor` property is set.
   */
  function createFileStatusChecker() {
    var cache: { [index: string]: fs.Stats } = {};
    return statusChecker;

    function statusChecker(filePath: FilePath): StatusCheckResult {
      var cached = cache[filePath];
      var stats = cache[filePath] = statFile(filePath);

      if ( !cached && !stats ) {
        return {
          status: FileStatus.notFound,
          exists: false
        };
      }

      if ( cached && !stats ) {
        return {
          status: FileStatus.deleted,
          stats: cached,
          exists: false
        };
      }

      if ( !cached && stats ) {
        return {
          status: FileStatus.newFile,
          stats: stats,
          exists: true,
          dirty: true
        };
      }

      var modified = cached.size !== stats.size ||
        cached.mtime.getTime() !== stats.mtime.getTime();

      return {
        status: modified ? FileStatus.modified : FileStatus.notModified,
        stats: stats,
        exists: true,
        dirty: modified
      };
    }
  }
}
