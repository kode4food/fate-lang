"use strict";

import { resolve as resolvePath } from 'path';
import { createModule, ModuleName, DirPath } from '../Fate';

const nodeModuleRegex = /^node:(.*)$/;
const relativePathRegex = /^\.|\../;

export function createNodeResolver() {
  return { resolve };

  function resolve(name: ModuleName, basePath?: DirPath) {
    try {
      let explicit = nodeModuleRegex.exec(name);
      if ( explicit ) {
        name = explicit[1];
      }
      else if ( basePath && relativePathRegex.test(name) ) {
        name = resolvePath(basePath, name);
      }
      return createModule(require(name));
    }
    catch ( err ) {
      return undefined;
    }
  }
}
