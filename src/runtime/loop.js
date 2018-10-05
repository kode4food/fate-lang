/** @flow */

import { isArray, isObject } from './index';
import { isGenerator, generateArray, generateObject } from './generator';

export function createIterator(collection: any) {
  if (isArray(collection)) {
    return generateArray(collection);
  }
  if (isGenerator(collection)) {
    return collection;
  }
  if (isObject(collection)) {
    return generateObject(collection);
  }
  return [];
}
