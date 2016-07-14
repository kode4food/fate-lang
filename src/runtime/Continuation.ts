"use strict";

import { GlobalScheduler } from "./Scheduler";

type PendingHandler = [Continuation, Resolve];
type PendingHandlers = PendingHandler | PendingHandler[];

type Result = Continuation | any;
type ResultOrArray = Result | any[];
type Resolve = (result: Result) => void;
type Fulfilled = (result: Result) => Result;
type Executor = (resolve: Resolve) => void;

enum State {
  Pending = 0,
  Fulfilled = 1
}

/* istanbul ignore next */
function noOp() { "noOp"; }

export function getThenFunction(value: any) {
  if ( value instanceof Continuation ) {
    return value.then.bind(value);
  }
  return null;
}

export class Continuation {
  protected state: State = State.Pending;
  protected result: Result;

  private pendingHandler: PendingHandler;
  private pendingHandlers: PendingHandlers;
  private pendingLength: number = 0;

  public static resolve(result: Result): Continuation {
    if ( result instanceof Continuation ) {
      return result;
    }
    return new Continuation(resolve => resolve(result));
  }

  public static race(resultOrArray: ResultOrArray): Continuation {
    return Continuation.resolve(resultOrArray).race();
  }

  public static all(resultOrArray: ResultOrArray): Continuation {
    return Continuation.resolve(resultOrArray).all();
  }

  constructor(executor: Executor) {
    if ( executor === noOp ) {
      return;
    }

    this.doResolve(executor);
  }

  public resolve(result: Result): void {
    let then = getThenFunction(result);
    if ( then ) {
      this.doResolve(then);
      return;
    }
    this.state = State.Fulfilled;
    this.result = result;
    GlobalScheduler.queue(this.notifyPending, this);
  }

  public then(onFulfilled: Fulfilled): Continuation {
    let continuation = new Continuation(noOp);
    this.addPending(continuation, onFulfilled);
    return continuation;
  }

  public race(): Continuation {
    return new Continuation(resolve => {
      this.then((array: Result) => {
        for ( let i = 0, len = array.length; i < len; i++ ) {
          let value = array[i];
          let then = getThenFunction(value);
          if ( then ) {
            then(resolve);
          }
          else {
            resolve(value);
          }
        }
      });
    });
  }

  public all(): Continuation {
    return new Continuation(resolve => {
      this.then((array: Result) => {
        let waitingFor = array.length;

        for ( let i = 0, len = waitingFor; i < len; i++ ) {
          let then = getThenFunction(array[i]);
          if ( then ) {
            resolveThenAtIndex(then, i);
            continue;
          }
          waitingFor--;
        }

        if ( waitingFor === 0 ) {
          resolve(array);
        }

        function resolveThenAtIndex(then: Function, index: number) {
          then(onFulfilled);

          function onFulfilled(result: Result): Result {
            array[index] = result;
            if ( --waitingFor === 0 ) {
              resolve(array);
            }
            return result;
          }
        }
      });
    });
  }

  protected addPending(target: Continuation, onFulfilled: Resolve): void {
    let pending: PendingHandler = [target, onFulfilled];

    if ( this.state === State.Fulfilled ) {
      GlobalScheduler.queue(() => {
        this.settlePending(pending);
      });
      return;
    }

    let pendingLength = this.pendingLength;
    if ( pendingLength === 0 ) {
      this.pendingHandler = pending;
      this.pendingLength = 1;
      return;
    }

    if ( pendingLength === 1 ) {
      this.pendingHandlers = [this.pendingHandler, pending];
      this.pendingHandler = undefined;
      this.pendingLength = 2;
      return;
    }

    let pendingHandlers = <PendingHandler[]>this.pendingHandlers;
    pendingHandlers[this.pendingLength++] = pending;
  }

  protected settlePending(pending: PendingHandler): void {
    pending[0].resolvePending(this.result, pending[1]);
  }

  protected resolvePending(result: Result, onFulfilled: Fulfilled): void {
    this.resolve(onFulfilled(result));
  }

  private doResolve(executor: Executor): void {
    let done: boolean;

    executor(result => {
      if ( done ) {
        return;
      }
      done = true;
      this.resolve(result);
    });
  }

  private notifyPending(): void {
    let pendingLength = this.pendingLength;
    if ( pendingLength === 0 ) {
      return;
    }

    if ( pendingLength === 1 ) {
      this.settlePending(<PendingHandler>this.pendingHandler);
      this.pendingLength = 0;
      this.pendingHandler = undefined;
      return;
    }

    let pendingHandlers = <PendingHandler[]>this.pendingHandlers;
    for ( let i = 0, len = this.pendingLength; i < len; i++ ) {
      this.settlePending((<PendingHandler[]>pendingHandlers)[i]);
      pendingHandlers[i] = undefined;
    }
    this.pendingHandlers = undefined;
    this.pendingLength = 0;
  }
}
