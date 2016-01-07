"use strict";

class Mutable {
  constructor(public value: any) {}

  public set(value: any) {
    this.value = value;
    return value;
  }
}

function createMutable(value: any) {
  return new Mutable(value);
}

function timeout(delay: number, callback: Function) {
  setTimeout(callback, delay);
}

export default {
  'node': {
    'null': null,
    'undefined': undefined,
    'console': console,
    'require': require
  },
  'mutable': createMutable,
  'print': console.log.bind(console.log),
  'timeout': timeout,
  '__filename': undefined,
  '__dirname': undefined
};
