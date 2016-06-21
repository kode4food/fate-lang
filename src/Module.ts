"use strict";

import { isObject } from './runtime/Pattern';

export type DirPath = string;
export type ModuleName = string;

export interface Module {
  __fateModule?: boolean;
  result?: any;
  exports: ModuleExports;
}

export interface ModuleExports {
  [index: string]: any;
}

export function createModule(moduleExports?: ModuleExports) {
  return {
    __fateModule: true,
    exports: moduleExports || {}
  };
}

export function isFateModule(module: any) {
  return ( typeof module === 'function' || isObject(module) ) &&
           module.__fateModule;
}
