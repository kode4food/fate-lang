"use strict";

import { isNothing } from './runtime/Pattern';

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

export const isArray = Array.isArray;

export function isObject(obj: any) {
  return typeof obj === 'object' && obj !== null && !isArray(obj);
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

export function isTrue(value: any) {
  return value !== false && value !== null &&
         value !== undefined && value !== 0 &&
         value !== isNothing;
}

export function isFalse(value: any) {
  return value === false || value === null ||
         value === undefined || value === 0 ||
         value === isNothing;
}

export function isIn(value: any, list: any) {
  if ( isArray(list) ) {
    return list.indexOf(value) !== -1;
  }
  if ( typeof list === 'object' && list !== null ) {
    return list.hasOwnProperty(value);
  }
  return false;
}
