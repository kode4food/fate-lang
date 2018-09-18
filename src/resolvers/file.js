/** @flow */

import { resolve as resolvePath } from 'path';

import type { DirPath, Module, ModuleName } from '../fate';
import { createModule } from '../fate';

type Options = {
  path: string;
}

const pathSuffixes = ['.fate', '/index.fate'];

export function createFileResolver(options: Options) {
  const cache: { [index: string]: Module } = {};
  const defaultBasePath: DirPath = options.path || process.cwd();
  return { resolve };

  function resolve(name: ModuleName, basePath?: DirPath) {
    if (!basePath) {
      basePath = defaultBasePath;
    }
    const cacheKey = `${basePath}//${name}`;
    let result = cache[cacheKey];
    if (result) {
      return result;
    }

    result = loadFromFileSystem(name, basePath);
    if (!result) {
      return undefined;
    }
    cache[cacheKey] = result;
    return result;
  }
}

function loadFromFileSystem(name: ModuleName, basePath: DirPath) {
  const checkPaths = pathSuffixes.map(
    suffix => resolvePath(basePath, name + suffix),
  );

  for (let i = 0; i < checkPaths.length; i++) {
    try {
      const moduleExports = require(checkPaths[i]);
      return createModule(moduleExports);
    } catch (err) {
      // no-op
    }
  }

  return undefined;
}
