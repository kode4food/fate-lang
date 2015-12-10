"use strict";

import { isArray, isObject } from '../Types';

let generator = require('../generator');
let isGenerator = generator.isGenerator;
let generateIndexedSet = generator.generateIndexedSet;

export type Collection = any[]|any|Function;

let EmptyCollection: Collection = [];

export function createIterator(collection: Collection) {
  if ( isArray(collection) || isObject(collection) ||
       isGenerator(collection) ) {
    return collection;
  }
  return EmptyCollection;
}

export function createNamedIterator(collection: Collection) {
  if ( isArray(collection) ) {
    return collection.map(function (item: any, index: number) {
      return [item, index];
    });
  }
  if ( isGenerator(collection) ) {
    return generateIndexedSet(collection);
  }
  if ( isObject(collection) ) {
    return Object.keys(collection).map(function (key) {
      return [collection[key], key];
    });
  }
  return EmptyCollection;
}
