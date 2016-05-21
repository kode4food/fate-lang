"use strict";

import { isTrue, isFalse } from '../Types';

type ArgTemplate = { [index: number]: any };

export interface FateFunction {
  (...args: any[]): any;
  __fate?: string;
}

const slice = Array.prototype.slice;

export function functionNotExhaustive() {
  throw new Error("Function invocation not exhaustive");
}

export function ensureFunction(func: Function): Function {
  return typeof func === 'function' ? func : functionNotExhaustive;
}

export function bindFunction(func: Function, args: ArgTemplate) {
  let indexes = Object.keys(args).map(Number);
  let templateSize = Math.max.apply(null, indexes);
  let template: any[] = [];
  let argMap: number[] = [];

  for ( let i = 0; i <= templateSize; i++ ) {
    if ( indexes.indexOf(i) !== -1 ) {
      template[i] = args[i];
    }
    else {
      argMap.push(i);
    }
  }

  let sliceIndex = argMap.length;
  return boundFunction;

  function boundFunction() {
    let funcArgs = template.slice().concat(slice.call(arguments, sliceIndex));
    for ( let i = 0; i < argMap.length; i++ ) {
      funcArgs[argMap[i]] = arguments[i];
    }
    return func.apply(this, funcArgs);
  }
}

export function composeOr(funcs: FateFunction[]) {
  let orWrapper: FateFunction = createWrapper(funcs, isTrue);
  (<FateFunction>orWrapper).__fate = checkComposition(funcs);
  return orWrapper;
}

export function composeAnd(funcs: FateFunction[]) {
  let orWrapper: FateFunction = createWrapper(funcs, isFalse);
  (<FateFunction>orWrapper).__fate = checkComposition(funcs);
  return orWrapper;
}

function checkComposition(funcs: FateFunction[]) {
  let fateType: string;

  for ( let i = 0; i < funcs.length; i++ ) {
    let func = funcs[i];
    if ( typeof func !== 'function' ) {
      throw new Error("Cannot compose values that are not functions");
    }
    fateType = fateType || func.__fate;
  }

  return fateType;
}

function createWrapper(funcs: FateFunction[], check: Function) {
  return function wrapper() {
    for ( let i = 0; i < funcs.length - 1; i++ ) {
      let result = funcs[i].apply(null, arguments);
      if ( check(result) ) {
        return result;
      }
    }
    return funcs[funcs.length - 1].apply(null, arguments);
  };
}
