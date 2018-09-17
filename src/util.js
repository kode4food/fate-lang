/** @flow */

type MixinObject = { [index: string]: any };

const isArray = Array.isArray;
const slice = Array.prototype.slice;

export function sliceArray(array: any[], startAt: number) {
  return slice.call(array, startAt);
}

export function mixin(target: MixinObject, ...source: any[]) {
  for (let i = 0; i < source.length; i++) {
    const src = source[i];
    if (typeof src !== 'object' || src === null || isArray(src)) {
      continue;
    }
    const keys = Object.keys(src);
    for (let j = keys.length - 1; j >= 0; j--) {
      const key = keys[j];
      target[key] = src[key];
    }
  }
  return target;
}

export function isIn(value: any, list: any) {
  if (isArray(list)) {
    return list.indexOf(value) !== -1;
  }
  if (typeof list === 'object' && list !== null) {
    return list.hasOwnProperty(value);
  }
  return false;
}
