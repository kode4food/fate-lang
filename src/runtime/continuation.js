/** @flow */

export type Result = Continuation | any;
export type ResultOrArray = Result | any[];
export type Resolver = (result: Result) => void;
export type Executor = (resolve: Resolver) => void;
export type Handler = (result: Result) => Result;

type PendingHandler = [Continuation, Handler];
type PendingHandlers = PendingHandler[];

function noOp() {
  'noOp';
}

class Scheduler {
  capacity: number;
  isFlushing: boolean;
  queueIndex: number;
  queueLength: number;

  constructor() {
    this.capacity = 16 * 2;
    this.isFlushing = false;
    this.queueIndex = 0;
    this.queueLength = 0;
  }

  queue(callback: Function, target?: Object): void {
    const { queueLength } = this;
    this[queueLength] = callback;
    this[queueLength + 1] = target;
    this.queueLength = queueLength + 2;
    if (!this.isFlushing) {
      this.isFlushing = true;
      setImmediate(() => this.flushQueue());
    }
  }

  collapseQueue(): void {
    const { queueIndex, queueLength } = this;
    let i = 0;
    const remainingLength = queueLength - queueIndex;
    for (; i < remainingLength; i++) {
      this[i] = this[queueIndex + i];
    }
    while (i < queueLength) {
      this[i++] = undefined;
    }
    this.queueIndex = 0;
    this.queueLength = remainingLength;
  }

  flushQueue(): void {
    while (this.queueIndex < this.queueLength) {
      const { queueIndex } = this;
      const callback = this[queueIndex];
      const target = this[queueIndex + 1];
      this.queueIndex = queueIndex + 2;

      if (this.queueLength > this.capacity) {
        this.collapseQueue();
      }

      callback.call(target);
    }
    this.isFlushing = false;
  }
}

const GlobalScheduler = new Scheduler();

export class Continuation {
  isResolved: boolean;
  result: Result;
  pendingHandler: ?PendingHandler;
  pendingHandlers: ?PendingHandlers;
  pendingLength: number;

  constructor(executor: Executor) {
    this.isResolved = false;
    this.pendingLength = 0;

    if (executor !== noOp) {
      this.resolveExecutor(executor);
    }
  }

  then(onFulfilled: Handler): Continuation {
    const continuation = new Continuation(noOp);
    this.addPending(continuation, onFulfilled);
    return continuation;
  }

  resolve(result: Result): void {
    if (result instanceof Continuation) {
      this.resolveContinuation(result);
      return;
    }
    this.isResolved = true;
    this.result = result;
    GlobalScheduler.queue(this.notifyPending, this);
  }

  addPending(target: Continuation, onFulfilled: Handler): void {
    const pending: PendingHandler = [target, onFulfilled];

    if (this.isResolved === true) {
      GlobalScheduler.queue(() => {
        this.settlePending(pending);
      });
      return;
    }

    const { pendingLength } = this;
    if (pendingLength === 0) {
      this.pendingHandler = pending;
      this.pendingLength = 1;
      return;
    }

    if (pendingLength === 1) {
      this.pendingHandlers = [this.pendingHandler, pending];
      this.pendingHandler = undefined;
      this.pendingLength = 2;
      return;
    }

    this.pendingHandlers[this.pendingLength++] = pending;
  }

  settlePending(pending: PendingHandler): void {
    pending[0].resolvePending(this.result, pending[1]);
  }

  resolvePending(result: Result, onFulfilled: Handler): void {
    this.resolve(onFulfilled(result));
  }

  resolveExecutor(executor: Executor): void {
    let done = false;

    executor((result) => {
      if (!done) {
        done = true;
        this.resolve(result);
      }
    });
  }

  resolveContinuation(continuation: Continuation): void {
    continuation.then((result) => {
      this.resolve(result);
    });
  }

  notifyPending(): void {
    const { pendingLength } = this;
    if (pendingLength === 0) {
      return;
    }

    if (pendingLength === 1) {
      this.settlePending(this.pendingHandler);
      this.pendingLength = 0;
      this.pendingHandler = undefined;
      return;
    }

    const { pendingHandlers } = this;
    for (let i = 0, len = this.pendingLength; i < len; i++) {
      this.settlePending(pendingHandlers[i]);
      pendingHandlers[i] = undefined;
    }
    this.pendingHandlers = undefined;
    this.pendingLength = 0;
  }
}
