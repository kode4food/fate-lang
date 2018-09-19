/** @flow */

import { resolve as resolvePath } from 'path';

import type { Resolver } from './index';
import type { Module, ModuleName, DirPath } from '../fate';
import { createModule } from '../fate';

const nodeModuleRegex = /^node:(.*)$/;
const relativePathRegex = /^\.|\../;

export function createNodeResolver(): Resolver {
  return { resolve };

  function resolve(name: ModuleName, basePath?: DirPath): ?Module {
    let n = name;
    const explicit = nodeModuleRegex.exec(n);
    if (explicit) {
      // eslint-disable-next-line prefer-destructuring
      n = explicit[1];
    } else if (basePath && relativePathRegex.test(n)) {
      n = resolvePath(basePath, n);
    }
    try {
      return createModule(require(n));
    } catch (err) {
      return undefined;
    }
  }
}
