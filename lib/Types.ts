/// <reference path="./Util.ts"/>
/// <reference path="./runtime/Match.ts"/>

"use strict";

namespace Fate.Types {
  import Runtime = Fate.Runtime;

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

  export interface Config {
    [name: string]: any;
  }

  export interface Context {
    [index: string]: any;
  }

  export function isObject(obj: any) {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
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
           value !== Runtime.none;
  }

  export function isFalse(value: any) {
    return value === false || value === null ||
           value === undefined || value === 0 ||
           value === Runtime.none;
  }

  export function isIn(value: any, list: any) {
    if ( Array.isArray(list) ) {
      return list.indexOf(value) !== -1;
    }
    if ( typeof list === 'object' && list !== null ) {
      return list.hasOwnProperty(value);
    }
    return false;
  }
}
