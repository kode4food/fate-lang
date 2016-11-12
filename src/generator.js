"use strict";

/*
 * This module exists only because TypeScript doesn't support generators
 * unless targeting ES6 or higher, but doing so will result in generated
 * code that node 4.x won't understand.  It would have been nice if the
 * TypeScript compiler passed the code through, but it strips the '*'
 * and breaks the world.
 */

// Checking for an already instantiated generator
function isGenerator(value) {
  if ( value === null || typeof value !== 'object' ) {
    return false;
  }
  return typeof value.next === 'function' && value.next.length === 1 &&
         typeof value.return === 'function' && value.return.length === 1 &&
         typeof value.throw === 'function' && value.throw.length === 1;
}

function* createRangeGenerator(start, end) {
  let current = start = Math.floor(start);
  end = Math.floor(end);
  let increment = end > start ? 1 : -1;
  let idx = 0;

  yield [current, idx++];
  while ( current !== end ) {
    current = current + increment;
    yield [current, idx++];
  }
}

function* generateArray(array) {
  for ( let i = 0; i < array.length; i++ ) {
    yield [array[i], i];
  }
}

function* generateObject(object) {
  for ( let key in object ) {
    /* istanbul ignore if: don't know where this object's been */
    if ( !object.hasOwnProperty(key) ) {
      continue;
    }
    yield [object[key], key];
  }
}

function materializeArray(collection) {
  let result = [];
  let idx = 0;
  for ( let item of collection ) {
    result[idx++] = item[0];
  }
  return result;
}

function materializeObject(collection) {
  let result = {};
  for ( let item of collection ) {
    result[item[1]] = item[0];
  }
  return result;
}

exports.isGenerator = isGenerator;
exports.createRangeGenerator = createRangeGenerator;
exports.generateArray = generateArray;
exports.generateObject = generateObject;
exports.materializeArray = materializeArray;
exports.materializeObject = materializeObject;
