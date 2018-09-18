/** @flow */

import { resolve as resolvePath } from 'path';

import type { ModuleName, DirPath } from '../fate';
import { createModule } from '../fate';

const nodeModuleRegex = /^node:(.*)$/;
const relativePathRegex = /^\.|\../;

export function createNodeResolver() {
  return { resolve };

  function resolve(name: ModuleName, basePath?: DirPath) {
    try {
      const explicit = nodeModuleRegex.exec(name);
      if (explicit) {
        // eslint-disable-next-line prefer-destructuring
        name = explicit[1];
      } else if (basePath && relativePathRegex.test(name)) {
        name = resolvePath(basePath, name);
      }
      return createModule(require(name));
    } catch (err) {
      return undefined;
    }
  }
}
