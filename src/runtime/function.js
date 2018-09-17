/** @flow */

import { isTrue, isFalse } from './pattern';

type ArgTemplate = { [index: number]: any };

export interface FateFunction {
  (...args: any[]): any;
  __fate?: string;
}

const slice = Array.prototype.slice;

export function functionNotExhaustive() {
  throw new Error('Function invocation not exhaustive');
}

export function ensureFunction(func: Function): Function {
  return typeof func === 'function' ? func : functionNotExhaustive;
}

export function bindFunction(func: Function, args: ArgTemplate) {
  const indexes = Object.keys(args).map(Number);
  const templateSize = Math.max.apply(null, indexes);
  const template: any[] = [];
  const argMap: number[] = [];

  for (let i = 0; i <= templateSize; i++) {
    if (indexes.indexOf(i) !== -1) {
      template[i] = args[i];
    } else {
      argMap.push(i);
    }
  }

  const sliceIndex = argMap.length;
  return boundFunction;

  function boundFunction(thisValue: any) {
    const funcArgs = template.slice().concat(slice.call(arguments, sliceIndex));
    for (let i = 0; i < argMap.length; i++) {
      funcArgs[argMap[i]] = arguments[i];
    }
    return func.apply(thisValue, funcArgs);
  }
}

export function compose(funcs: FateFunction[]) {
  wrapper.__fate = checkComposition(funcs);
  return wrapper;

  function wrapper() {
    let result = funcs[0].apply(null, arguments);
    for (let i = 1; i < funcs.length; i++) {
      result = funcs[i](result);
    }
    return result;
  }
}

export function composeOr(funcs: FateFunction[]) {
  return createWrapper(funcs, isTrue);
}

export function composeAnd(funcs: FateFunction[]) {
  return createWrapper(funcs, isFalse);
}

function createWrapper(funcs: FateFunction[], check: Function) {
  wrapper.__fate = checkComposition(funcs);
  return wrapper;

  function wrapper() {
    for (let i = 0; i < funcs.length - 1; i++) {
      const result = funcs[i].apply(null, arguments);
      if (check(result)) {
        return result;
      }
    }
    return funcs[funcs.length - 1].apply(null, arguments);
  }
}

function checkComposition(funcs: FateFunction[]) {
  let fateType: string;

  for (let i = 0; i < funcs.length; i++) {
    const func = funcs[i];
    if (typeof func !== 'function') {
      throw new Error('Cannot compose values that are not functions');
    }
    fateType = fateType || func.__fate;
  }

  return fateType;
}
