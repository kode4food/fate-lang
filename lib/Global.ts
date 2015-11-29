/// <reference path="../typings/tsd.d.ts"/>

"use strict";

namespace Fate {
  export var Global = {
    mutable: createMutable,
    console: console,
    require: require,
    __filename: <string>undefined,
    __dirname: <string>undefined,
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
