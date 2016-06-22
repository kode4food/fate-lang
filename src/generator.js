"use strict";

/*
 * This module exists only because TypeScript doesn't support generators
 * unless targeting ES6 or higher, but doing so will result in generated
 * code that node 4.x won't understand.  It would have been nice if the
 * TypeScript compiler passed the code through, but it strips the '*'
 * and breaks the world.
 */

/* istanbul ignore next: Used to fetch constructor. Is never run */
function* dummy() { }
const GeneratorConstructor = dummy().constructor;

function isGenerator(value) {
  if ( value === null || typeof value !== 'object' ) {
    return false;
  }
  return value.constructor === GeneratorConstructor;
}

function* createRangeGenerator(start, end) {
  let current = start = Math.floor(start);
  end = Math.floor(end);
  let increment = end > start ? 1 : -1;

  yield current;
  while ( current !== end ) {
    current = current + increment;
    yield current;
  }
}

function* generateIndexedSet(generator) {
  let index = 0;
  for ( let value of generator ) {
    yield [value, index++];
  }
}

exports.isGenerator = isGenerator;
exports.createRangeGenerator = createRangeGenerator;
exports.generateIndexedSet = generateIndexedSet;
