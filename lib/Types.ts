/// <reference path="./Util.ts"/>

"use strict";

namespace Fate.Types {
  export type ModulePath = string;
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

  export function isTruthy(value: any) {
    if ( !value ) {
      return false;
    }
    if ( Array.isArray(value) ) {
      return value.length > 0;
    }
    if ( typeof value === 'object' && value !== null ) {
      return Object.keys(value).length > 0;
    }
    return true;
  }

  export function isFalsy(value: any) {
    if ( !value ) {
      return true;
    }
    if ( Array.isArray(value) ) {
      return value.length === 0;
    }
    if ( typeof value === 'object' && value !== null ) {
      return Object.keys(value).length === 0;
    }
    return false;
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
