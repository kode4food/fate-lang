"use strict";

const Promise = require('welsh').Promise;

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

function timeout(delay: number) {
  return new Promise(function (resolve: Function) {
    setTimeout(function () {
      resolve(delay);
    }, delay);
  });
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
