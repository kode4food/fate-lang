"use strict";

const slice = Array.prototype.slice;

export { isArray, isObject, isTrue, isFalse, isIn } from './Types';

export * from './runtime/Do';
export * from './runtime/Format';
export * from './runtime/Function';
export * from './runtime/Import';
export * from './runtime/Loop';
export * from './runtime/Pattern';

export function sliceArray(array: any[], startAt: number) {
  return slice.call(array, startAt);
}
