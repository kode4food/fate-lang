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
  entries: any[] = [];
  capacity = 16 * 2;
  isFlushing = false;
  queueIndex = 0;
  queueLength = 0;

  queue(callback: Function, target?: {}): void {
    const { queueLength } = this;
    this.entries[queueLength] = callback;
    this.entries[queueLength + 1] = target;
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
    for (; i < remainingLength; i += 1) {
      this.entries[i] = this.entries[queueIndex + i];
    }
    while (i < queueLength) {
      this.entries[i] = undefined;
      i += 1;
    }
    this.queueIndex = 0;
    this.queueLength = remainingLength;
  }

  flushQueue(): void {
    while (this.queueIndex < this.queueLength) {
      const { queueIndex } = this;
      const callback = this.entries[queueIndex];
      const target = this.entries[queueIndex + 1];
      this.queueIndex = queueIndex + 2;

      if (this.queueLength > this.capacity) {
        this.collapseQueue();
      }

      callback.call(target);
    }
    this.isFlushing = false;
  }
}

const globalScheduler = new Scheduler();

export class Continuation {
  isResolved = false;
  result: Result;
  pendingHandlers: PendingHandlers = [];
  pendingLength = 0

  constructor(executor: Executor) {
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
    globalScheduler.queue(this.notifyPending, this);
  }

  addPending(target: Continuation, onFulfilled: Handler): void {
    const pending: PendingHandler = [target, onFulfilled];

    if (this.isResolved === true) {
      globalScheduler.queue(() => {
        this.settlePending(pending);
      });
      return;
    }

    const { pendingLength } = this;
    this.pendingHandlers[pendingLength] = pending;
    this.pendingLength = pendingLength + 1;
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

    const { pendingHandlers } = this;
    for (let i = 0, len = this.pendingLength; i < len; i += 1) {
      this.settlePending(pendingHandlers[i]);
      pendingHandlers[i] = undefined;
    }
    this.pendingHandlers = undefined;
    this.pendingLength = 0;
  }
}
