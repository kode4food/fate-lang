"use strict";

namespace Fate.Resolvers.System.List {
  type StringIndexedObject = { [index: string]: any };

  // `first(value)` returns the first item of the provided array (or `null` if
  // the array is empty).
  export function first(value: any|any[]) {
    if ( Array.isArray(value) ) {
      return value[0];
    }
    if ( typeof value === 'object' && value !== null ) {
      var name = Object.keys(value)[0];
      var val = value[name];
      return {
        name: name,
        value: val === null ? undefined : val
      };
    }
    return value;
  }

  // `join(value, delim)` returns the result of joining the elements of the
  // provided array. Each element will be concatenated into a string separated
  // by the specified delimiter (or ' ').
  export function join(value: any|any[], delim: string): string {
    if ( delim === undefined ) {
      delim = ' ';
    }
    if ( Array.isArray(value) ) {
      return value.join(delim);
    }
    return value;
  }

  // `last(value)` returns the last item of the provided array (or `nil` if
  // the array is empty).
  export function last(value: any|any[]) {
    if ( Array.isArray(value) ) {
      return value[value.length - 1];
    }
    if ( typeof value === 'object' && value !== null ) {
      var keys = Object.keys(value);
      var name = keys[keys.length - 1];
      var val = value[name];
      return {
        name: name,
        value: val === null ? undefined : val
      };
    }
    return value;
  }

  // `length(value)` if it is an array, returns the length of the provided
  // value, if an object, the number of keys, otherwise `0`.
  export function length(value: any|any[]) {
    if ( Array.isArray(value) ) {
      return value.length;
    }
    if ( typeof value === 'object' && value !== null ) {
      return Object.keys(value).length;
    }
    return 0;
  }

  // `empty(value)` returns true or false depending on whether or not the
  // provided array is empty.
  export function empty(value: any|any[]) {
    return length(value) === 0;
  }

  // `keys(value)` returns the keys of the Object or indexes of the Array
  // passed to it.  If the Array is sparse (has gaps) it will only return
  // the indexes with assigned values.
  export function keys(value: Object) {
    if ( typeof value === 'object' && value !== null ) {
      return Object.keys(value);
    }
    return undefined;
  }

  // values(value)` returns the values of the Object or Array passed to
  // it.  If the array is sparse (has gaps) it will only return the
  // assigned values.
  export function values(value: StringIndexedObject) {
    if ( typeof value !== 'object' || value === null ) {
      return undefined;
    }
    var keys = Object.keys(value);
    var result: any[] = [];
    for ( var i = 0, len = keys.length; i < len; i++ ) {
      result[i] = value[keys[i]];
    }
    return result;
  }
}
