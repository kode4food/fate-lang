"use strict";

namespace Fate.Resolvers.System.ArrayModule {
  const isArray = Array.isArray;

  // `first(value)` returns the first item of the provided array (or `null` if
  // the array is empty).
  export function first(value: any[]) {
    return isArray(value) ? value[0] : value;
  }

  // `join(value, delim)` returns the result of joining the elements of the
  // provided array. Each element will be concatenated into a string separated
  // by the specified delimiter (or ' ').
  export function join(value: any[], delim = ' '): string {
    return (isArray(value) ? value : [value]).join(delim);
  }

  // `last(value)` returns the last item of the provided array (or `nil` if
  // the array is empty).
  export function last(value: any[]) {
    return isArray(value) ? value[value.length - 1] : value;
  }

  // `length(value)` if it is an array, returns the length of the value
  export function length(value: any[]) {
    return isArray(value) ? value.length : 0;
  }

  // `empty(value)` returns true or false depending on whether or not the
  // provided array is empty.
  export function empty(value: any|any[]) {
    return length(value) === 0;
  }
}
