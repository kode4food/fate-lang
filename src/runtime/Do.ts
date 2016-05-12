"use strict";

const welsh = require('welsh');
const Promise = welsh.Promise;
const Deferred = welsh.Deferred;

interface GeneratorResult {
  done: boolean;
  value: any;
}

export function createDoBlock(generator: Function) {
  return new Promise((resolve: Function) => {
    let generating = generator.apply(null);
    step(generating.next());

    function fulfilled(value: any) {
      step(generating.next(value));
    }

    function step(result: GeneratorResult) {
      if ( result.done ) {
        resolve(result.value);
        return;
      }

      let [resolver, arg] = result.value;
      resolver(arg).then(fulfilled);
    }
  });
}

export function awaitValue(value: any) {
  return Deferred.resolve(value);
}

export function awaitAny(array: any[]) {
  return Deferred.race(array);
}

export function awaitAll(array: any[]) {
  return Deferred.all(array);
}
