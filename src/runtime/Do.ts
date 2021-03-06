"use strict";

const isArray = Array.isArray;

import { Continuation, Result, ResultOrArray } from './Continuation';

interface GeneratorResult {
  done: boolean;
  value: any;
}

export function createDoBlock(generator: Function) {
  return new Continuation(resolve => {
    let generating = generator.apply(null);
    step(generating.next());

    function fulfilled(value: Result) {
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

export function awaitValue(result: Result): Continuation {
  if ( result instanceof Continuation ) {
    return result;
  }
  return new Continuation(resolve => resolve(result));
}

function awaitArray(resultOrArray: ResultOrArray) {
  return awaitValue(resultOrArray).then(prepareArray);

  function prepareArray(result: any) {
    /* istanbul ignore if: TODO - need to figure out a way to test */
    if ( !isArray(result) ) {
      throw new TypeError("An Array is required");
    }
    return result.slice();
  }
}

export function awaitAny(resultOrArray: ResultOrArray): Continuation {
  return awaitArray(resultOrArray).then((array: Result[]) => {
    return new Continuation(resolve => {
      for ( let i = 0, len = array.length; i < len; i++ ) {
        let value = array[i];
        if ( value instanceof Continuation ) {
          value.then(resolve);
        }
        else {
          resolve(value);
        }
      }
    });
  });
}

export function awaitAll(resultOrArray: ResultOrArray): Continuation {
  return awaitArray(resultOrArray).then((array: Result[]) => {
    return new Continuation(resolve => {
      let waitingFor = array.length;

      for ( let i = 0, len = waitingFor; i < len; i++ ) {
        if ( array[i] instanceof Continuation ) {
          array[i].then(resolveArrayAtIndex(i));
          continue;
        }
        waitingFor--;
      }

      if ( waitingFor === 0 ) {
        resolve(array);
      }

      function resolveArrayAtIndex(index: number) {
        return (result: Result) => {
          array[index] = result;
          if ( --waitingFor === 0 ) {
            resolve(array);
          }
          return result;
        };
      }
    });
  });
}
