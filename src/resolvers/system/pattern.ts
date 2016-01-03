"use strict";

import { isObject, isArray } from '../../Types';

import {
  isPattern, definePattern, Pattern, isNothing, isSomething
} from '../../runtime/Pattern';

export let Nothing = isNothing;
export let Something = isSomething;

export let String = definePattern(function (value) {
  return typeof value === 'string';
});

export let EmptyString = definePattern(function (value) {
  return value === "";
});

export let NonEmptyString = definePattern(function (value) {
  return typeof value === 'string' && value.length > 0;
});

export let Number = definePattern(function (value) {
  return typeof value === 'number';
});

export let PositiveNumber = definePattern(function (value) {
  return typeof value === 'number' && value > 0;
});

export let NegativeNumber = definePattern(function (value) {
  return typeof value === 'number' && value < 0;
});

export let Integer = definePattern(function (value) {
  return typeof value === 'number' && value % 1 === 0;
});

export let PositiveInteger = definePattern(function (value) {
  return typeof value === 'number' && value > 0 && value % 1 === 0;
});

export let NegativeInteger = definePattern(function (value) {
  return typeof value === 'number' && value < 0 && value % 1 === 0;
});

export let Boolean = definePattern(function (value) {
  return typeof value === 'boolean';
});

export let Array = definePattern(<Pattern>isArray);
export let Object = definePattern(isObject);

export function ArrayOf(elementPattern?: Pattern) {
  if ( !isPattern(elementPattern) ) {
    return Array;
  }
  return definePattern(function (value) {
    if ( !isArray(value) ) {
      return false;
    }
    for ( let i = 0; i < value.length; i++ ) {
      if ( !elementPattern(value[i]) ) {
        return false;
      }
    }
    return true;
  });
}
