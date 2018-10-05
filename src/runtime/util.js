/** @flow */

import { isArray, isObject } from './pattern';

const { slice } = Array.prototype;

export function sliceArray(array: any[], startAt: number) {
  return slice.call(array, startAt);
}

export function mixin(target: {}, ...source: any[]) {
  const t = target;
  for (let i = 0; i < source.length; i += 1) {
    const src = source[i];
    if (isObject(src)) {
      const keys = Object.keys(src);
      for (let j = keys.length - 1; j >= 0; j -= 1) {
        const key = keys[j];
        t[key] = src[key];
      }
    }
  }
  return t;
}

export function isIn(value: any, list: any) {
  if (isArray(list)) {
    return list.indexOf(value) !== -1;
  }
  if (isObject(list)) {
    return Object.prototype.hasOwnProperty.call(list, value);
  }
  return false;
}
