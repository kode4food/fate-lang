/// <reference path="../typings/tsd.d.ts"/>

"use strict";

namespace Fate {
  interface AnyMap {
    [index: string]: any;
  }

  export let Global: AnyMap = {
    node: {
      null: null,
      undefined: undefined,
      console: console,
      setTimeout: setTimeout,
      require: require
    },
    mutable: createMutable,
    print: console.log.bind(console.log),
    timeout: setTimeout,
    __filename: undefined,
    __dirname: undefined,
  };

  class Mutable {
    constructor(public value: any) {}

    public set(value: any) {
      this.value = value;
      return value;
    }

    public get get() {
      return this.value;
    }
  }

  function createMutable(value: any) {
    return new Mutable(value);
  }
}
