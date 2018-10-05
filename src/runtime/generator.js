/** @flow */

import { isObjectOrArray } from './pattern';

type Indexed = Generator<[any, number], void, void>;
type Keyed = Generator<[any, string], void, void>;

// Checking for an already instantiated generator
export function isGenerator(value: any) {
  if (!isObjectOrArray(value)) {
    return false;
  }
  return typeof value.next === 'function' && value.next.length === 1;
}

export function* createRangeGenerator(start: number, end: number): Indexed {
  let current = Math.floor(start);
  const e = Math.floor(end);
  const increment = e > current ? 1 : -1;
  let idx = 0;

  yield [current, idx];
  idx += 1;
  while (current !== e) {
    current += increment;
    yield [current, idx];
    idx += 1;
  }
}

export function* generateArray(array: any[]): Indexed {
  for (let i = 0; i < array.length; i += 1) {
    yield [array[i], i];
  }
}

export function* generateObject(object: {}): Keyed {
  for (const key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      yield [object[key], key];
    }
  }
}

export function materializeArray(collection: any[]) {
  const result = [];
  let idx = 0;
  for (const item of collection) {
    // eslint-disable-next-line prefer-destructuring
    result[idx] = item[0];
    idx += 1;
  }
  return result;
}

export function materializeObject(collection: any[]) {
  const result = {};
  for (const item of collection) {
    // eslint-disable-next-line prefer-destructuring
    result[item[1]] = item[0];
  }
  return result;
}
