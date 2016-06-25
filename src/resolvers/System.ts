"use strict";

import { resolve as resolvePath } from 'path';

import { createModule, Module, ModuleName } from '../Fate';

const basePath = resolvePath(__dirname, '../modules');

export function createSystemResolver() {
  let cache: { [index: string]: Module } = {};
  return { resolve };

  function resolve(name: ModuleName): Module {
    if ( name in cache ) {
      return cache[name];
    }
    return cache[name] = tryRequire(name + '.fate');
  }

  function tryRequire(filename: string) {
    try {
      return createModule(require(resolvePath(basePath, filename)));
    }
    catch ( err ) {
      return undefined;
    }
  }
}
