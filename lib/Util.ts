"use strict";

namespace Fate.Util {
  type MixinObject = { [index: string]: any };

  export function mixin(target: MixinObject, ...source: any[]) {
    for ( var i = 0, ilen = source.length; i < ilen; i++ ) {
      var src = source[i];
      if ( typeof src !== 'object' || src === null || Array.isArray(src) ) {
        continue;
      }
      var keys = Object.keys(src);
      for ( var j = keys.length - 1; j >= 0; j-- ) {
        var key = keys[j];
        target[key] = src[key];
      }
    }
    return target;
  }
}
