"use strict";

import { isArray, isObject } from '../Types';

const generator = require('../generator');
const isGenerator = generator.isGenerator;
const generateIndexedSet = generator.generateIndexedSet;

export type Collection = any[]|any|Function;

const EmptyCollection: Collection = [];

export function createIterator(collection: Collection) {
  if ( isArray(collection) || isObject(collection) ||
       isGenerator(collection) ) {
    return collection;
  }
  return EmptyCollection;
}

export function createNamedIterator(collection: Collection) {
  if ( isArray(collection) ) {
    return collection.map((item: any, index: number) => [item, index]);
  }
  if ( isGenerator(collection) ) {
    return generateIndexedSet(collection);
  }
  if ( isObject(collection) ) {
    return Object.keys(collection).map(key => [collection[key], key]);
  }
  return EmptyCollection;
}
