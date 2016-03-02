"use strict";

const Promise = require('welsh').Promise;

interface GeneratorResult {
  done: boolean;
  value: any;
}

export function createDoBlock(generator: Function) {
  return new Promise(function (resolve: Function) {
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
  return Promise.resolve(value);
}

export function awaitAny(array: any[]) {
  return Promise.race(array);
}

export function awaitAll(array: any[]) {
  return Promise.all(array);
}
