"use strict";

export class Scheduler {
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

export const GlobalScheduler = new Scheduler();
