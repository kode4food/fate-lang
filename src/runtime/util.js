/** @flow */

const { isArray } = Array;
const { slice } = Array.prototype;

export function sliceArray(array: any[], startAt: number) {
  return slice.call(array, startAt);
}

export function mixin(target: {}, ...source: any[]) {
  const t = target;
  for (let i = 0; i < source.length; i += 1) {
    const src = source[i];
    if (typeof src === 'object' && src !== null && !isArray(src)) {
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
  if (typeof list === 'object' && list !== null) {
    return Object.prototype.hasOwnProperty.call(list, value);
  }
  return false;
}
