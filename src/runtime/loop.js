/** @flow */

import { isArray, isObject } from './index';
import { isGenerator, generateArray, generateObject } from './generator';

export type Collection = any[] | any | Function;

const EmptyCollection: Collection = [];

export function createIterator(collection: Collection) {
  if (isArray(collection)) {
    return generateArray(collection);
  }
  if (isGenerator(collection)) {
    return collection;
  }
  if (isObject(collection)) {
    return generateObject(collection);
  }
  return EmptyCollection;
}
