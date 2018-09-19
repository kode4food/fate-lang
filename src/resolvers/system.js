/** @flow */

import { resolve as resolvePath } from 'path';

import type { Resolver } from './index';
import type { Module, ModuleName } from '../fate';
import { createModule } from '../fate';

const moduleBasePath = resolvePath(__dirname, '../modules');

export function createSystemResolver(): Resolver {
  const cache: { [index: string]: ?Module } = {};
  return { resolve };

  function resolve(name: ModuleName, basePath?: string): ?Module {
    if (name in cache) {
      return cache[name];
    }
    const module = tryRequire(`${name}.fate`);
    cache[name] = module;
    return module;
  }

  function tryRequire(filename: string): ?Module {
    try {
      return createModule(require(resolvePath(moduleBasePath, filename)));
    } catch (err) {
      return undefined;
    }
  }
}
