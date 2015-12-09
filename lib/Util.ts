"use strict";

namespace Fate.Util {
  const isArray = Array.isArray;

  type MixinObject = { [index: string]: any };

  export function mixin(target: MixinObject, ...source: any[]) {
    for ( let i = 0; i < source.length; i++ ) {
      let src = source[i];
      if ( typeof src !== 'object' || src === null || isArray(src) ) {
        continue;
      }
      let keys = Object.keys(src);
      for ( let j = keys.length - 1; j >= 0; j-- ) {
        let key = keys[j];
        target[key] = src[key];
      }
    }
    return target;
  }
}
