/// <reference path="../../Types.ts"/>
/// <reference path="../../runtime/Match.ts"/>

"use strict";

let isArray = Array.isArray;

namespace Fate.Resolvers.System.Pattern {
  import definePattern = Runtime.definePattern;

  export import Nothing = Runtime.isNothing;
  export import Something = Runtime.isSomething;
  
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

  export let Array = definePattern(isArray);
  export let Object = definePattern(Types.isObject);
}
