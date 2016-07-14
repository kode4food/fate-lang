"use strict";

const Continuation = require('./Continuation').Continuation;

interface GeneratorResult {
  done: boolean;
  value: any;
}

export function createDoBlock(generator: Function) {
  return new Continuation((resolve: Function) => {
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

export const awaitValue = Continuation.resolve;
export const awaitAny = Continuation.resolveAny;
export const awaitAll = Continuation.resolveAll;
