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

      Promise.resolve(result.value).then(fulfilled);
    }
  });
}
