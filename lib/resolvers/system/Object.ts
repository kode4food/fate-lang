/// <reference path="../../Types.ts"/>

"use strict";

namespace Fate.Resolvers.System.ObjectModule {
  type StringIndexedObject = { [index: string]: any };

  // `keys(value)` returns the keys of the Object
  export function keys(value: Object): string[] {
    if ( Types.isObject(value) ) {
      return Object.keys(value);
    }
    return undefined;
  }

  // values(value)` returns the values of the Object.
  export function values(value: StringIndexedObject) {
    if ( !Types.isObject(value) ) {
      return undefined;
    }
    let keys = Object.keys(value);
    let result: any[] = [];
    for ( let i = 0, len = keys.length; i < len; i++ ) {
      result[i] = value[keys[i]];
    }
    return result;
  }
}
