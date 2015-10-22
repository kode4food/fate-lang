/// <reference path="../Types.ts"/>

"use strict";

namespace Fate.Runtime {
  var slice = Array.prototype.slice;

  function noOp() {}

  type ArgTemplate = { [index: number]: any };

  export function defineGuardedFunction(originalFunction: Function,
                                        envelope: Function) {
    if ( typeof originalFunction !== 'function' ) {
      originalFunction = noOp;
    }
    return envelope(originalFunction);
  }

  export function bindFunction(func: Function, args: ArgTemplate) {
    var indexes = Object.keys(args).map(Number);
    var templateSize = indexes.length ? Math.max.apply(null, indexes): 0;
    var template: any[] = [];
    var argMap: number[] = [];

    for ( var i = 0; i <= templateSize; i++ ) {
      if ( indexes.indexOf(i) !== -1 ) {
        template[i] = args[i];
      }
      else {
        argMap.push(i);
      }
    }

    var sliceIndex = argMap.length;
    return boundFunction;

    function boundFunction() {
      var args = template.slice().concat(slice.call(arguments, sliceIndex));
      for ( var i = 0; i < argMap.length; i++ ) {
        args[argMap[i]] = arguments[i];
      }
      return func.apply(this, args);
    }
  }
}
