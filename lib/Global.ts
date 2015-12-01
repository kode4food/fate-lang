/// <reference path="../typings/tsd.d.ts"/>

"use strict";

namespace Fate {
  interface AnyMap {
    [index: string]: any;
  }
  
  export var Global: AnyMap = {
    null: null,
    undefined: undefined,
    mutable: createMutable,
    console: console,
    require: require,
    __filename: undefined,
    __dirname: undefined,
    setTimeout: setTimeout
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
