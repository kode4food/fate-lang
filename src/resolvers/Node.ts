"use strict";

import * as path from 'path';

import { createModule, ModuleName, DirPath } from '../Types';

const relativePathRegex = /^\.|\../;

export function createNodeResolver() {
  return {
    resolve: resolve
  };

  function resolve(name: ModuleName, basePath?: DirPath) {
    try {
      if ( basePath && relativePathRegex.test(name) ) {
        name = path.resolve(basePath, name);
      }
      return createModule(require(name));
    }
    catch ( err ) {
      return undefined;
    }
  }
}
