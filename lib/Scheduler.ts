"use strict";

namespace Fate {
  export class Scheduler {
    [index: number]: any;
    private _capacity: number = 16 * 2;
    private _isFlushing: boolean = false;
    private _queueIndex: number = 0;
    private _queueLength: number = 0;

    public queue(callback: Function, args: any[]): void {
      let queueLength = this._queueLength;
      this[queueLength] = callback;
      this[queueLength + 1] = args;
      this._queueLength = queueLength + 2;
      if ( !this._isFlushing ) {
        this._isFlushing = true;
        setImmediate(() => { this.flushQueue(); });
      }
    }

    private collapseQueue(): void {
      let queueIndex = this._queueIndex;
      let queueLength = this._queueLength;
      let i = 0;
      let len = queueLength - queueIndex;

      for ( ; i < len; i++ ) {
        this[i] = this[queueIndex + i];
      }
      while ( i < queueLength ) {
        this[i++] = undefined;
      }
      this._queueIndex = 0;
      this._queueLength = len;
    }

    private flushQueue(): void {
      while ( this._queueIndex < this._queueLength ) {
        let queueIndex = this._queueIndex;
        let callback = this[queueIndex];
        let args = this[queueIndex + 1];
        this._queueIndex = queueIndex + 2;

        if ( this._queueLength > this._capacity ) {
          this.collapseQueue();
        }

        callback.apply(null, args);
      }
      this._isFlushing = false;
    }
  }

  export let GlobalScheduler = new Scheduler();
}
