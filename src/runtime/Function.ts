"use strict";

type ArgTemplate = { [index: number]: any };

let slice = Array.prototype.slice;

function noOp() {
  throw new Error("Function invocation not exhaustive");
}

export function ensureFunction(func: Function): Function {
  return typeof func === 'function' ? func : noOp;
}

export function bindFunction(func: Function, args: ArgTemplate) {
  let indexes = Object.keys(args).map(Number);
  let templateSize = Math.max.apply(null, indexes);
  let template: any[] = [];
  let argMap: number[] = [];

  for ( let i = 0; i <= templateSize; i++ ) {
    if ( indexes.indexOf(i) !== -1 ) {
      template[i] = args[i];
    }
    else {
      argMap.push(i);
    }
  }

  let sliceIndex = argMap.length;
  return boundFunction;

  function boundFunction() {
    let funcArgs = template.slice().concat(slice.call(arguments, sliceIndex));
    for ( let i = 0; i < argMap.length; i++ ) {
      funcArgs[argMap[i]] = arguments[i];
    }
    return func.apply(this, funcArgs);
  }
}
