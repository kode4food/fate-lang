"use strict";

import { resolve as resolvePath } from 'path';
import { createModule, ModuleName, DirPath } from '../Types';

const relativePathRegex = /^\.|\../;

export function createNodeResolver() {
  return { resolve };

  function resolve(name: ModuleName, basePath?: DirPath) {
    try {
      if ( basePath && relativePathRegex.test(name) ) {
        name = resolvePath(basePath, name);
      }
      return createModule(require(name));
    }
    catch ( err ) {
      return undefined;
    }
  }
}
