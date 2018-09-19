/** @flow */

import { resolve as resolvePath } from 'path';

import type { Resolver } from './index';
import type { DirPath, Module, ModuleName } from '../fate';
import { createModule } from '../fate';

export type FileResolverOptions = {
  path: string;
}

const pathSuffixes = ['.fate', '/index.fate'];

export function createFileResolver(options: FileResolverOptions): Resolver {
  const cache: { [index: string]: Module } = {};
  const defaultBasePath: DirPath = options.path || process.cwd();
  return { resolve };

  function resolve(name: ModuleName, basePath?: DirPath): ?Module {
    const b = basePath || defaultBasePath;
    const cacheKey = `${b}//${name}`;
    let result = cache[cacheKey];
    if (result) {
      return result;
    }

    result = loadFromFileSystem(name, b);
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

  for (let i = 0; i < checkPaths.length; i += 1) {
    try {
      const moduleExports = require(checkPaths[i]);
      return createModule(moduleExports);
    } catch (err) {
      // no-op
    }
  }

  return undefined;
}
