"use strict";

type PendingHandler = [Continuation, Resolve];
type PendingHandlers = PendingHandler[];

type Result = Continuation | any;
type ResultOrArray = Result | any[];
type Resolve = (result: Result) => void;
type Fulfilled = (result: Result) => Result;
type Executor = (resolve: Resolve) => void;

/* istanbul ignore next */
function noOp() { "noOp"; }

class Scheduler {
  [index: number]: any;
  private capacity: number = 16 * 2;
  private isFlushing: boolean = false;
  private queueIndex: number = 0;
  private queueLength: number = 0;

  public queue(callback: Function, target?: Object): void {
    let queueLength = this.queueLength;
    this[queueLength] = callback;
    this[queueLength + 1] = target;
    this.queueLength = queueLength + 2;
    if ( !this.isFlushing ) {
      this.isFlushing = true;
      setImmediate(() => this.flushQueue());
    }
  }

  private collapseQueue(): void {
    let queueIndex = this.queueIndex;
    let queueLength = this.queueLength;
    let i = 0;
    let len = queueLength - queueIndex;
    for ( ; i < len; i++ ) {
      this[i] = this[queueIndex + i];
    }
    while ( i < queueLength ) {
      this[i++] = undefined;
    }
    this.queueIndex = 0;
    this.queueLength = len;
  }

  private flushQueue(): void {
    while ( this.queueIndex < this.queueLength ) {
      let queueIndex = this.queueIndex;
      let callback = this[queueIndex];
      let target = this[queueIndex + 1];
      this.queueIndex = queueIndex + 2;

      if ( this.queueLength > this.capacity ) {
        this.collapseQueue();
      }

      callback.call(target);
    }
    this.isFlushing = false;
  }
}

const GlobalScheduler = new Scheduler();

export function getThenFunction(value: any) {
  if ( value instanceof Continuation ) {
    return value.then.bind(value);
  }
  return null;
}

export class Continuation {
  protected isFulfilled: boolean = false;
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

  public static resolveAny(resultOrArray: ResultOrArray): Continuation {
    return new Continuation(resolve => {
      Continuation.resolve(resultOrArray).then((array: Result) => {
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

  public static resolveAll(resultOrArray: ResultOrArray): Continuation {
    return new Continuation(resolve => {
      Continuation.resolve(resultOrArray).then((array: Result) => {
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

  constructor(executor: Executor) {
    if ( executor === noOp ) {
      return;
    }

    this.doResolve(executor);
  }

  public then(onFulfilled: Fulfilled): Continuation {
    let continuation = new Continuation(noOp);
    this.addPending(continuation, onFulfilled);
    return continuation;
  }

  protected resolve(result: Result): void {
    let then = getThenFunction(result);
    if ( then ) {
      this.doResolve(then);
      return;
    }
    this.isFulfilled = true;
    this.result = result;
    GlobalScheduler.queue(this.notifyPending, this);
  }

  protected addPending(target: Continuation, onFulfilled: Resolve): void {
    let pending: PendingHandler = [target, onFulfilled];

    if ( this.isFulfilled === true ) {
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
