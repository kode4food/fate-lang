"use strict";

import { isArray, isObject } from './index';

const generator = require('../generator');
const isGenerator = generator.isGenerator;
const generateArray = generator.generateArray;
const generateObject = generator.generateObject;

export type Collection = any[]|any|Function;

const EmptyCollection: Collection = [];

export function createIterator(collection: Collection) {
  if ( isArray(collection) ) {
    return generateArray(collection);
  }
  if ( isGenerator(collection) ) {
    return collection;
  }
  if ( isObject(collection) ) {
    return generateObject(collection);
  }
  return EmptyCollection;
}
