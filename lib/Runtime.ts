/// <reference path="./Types.ts"/>
/// <reference path="./Util.ts"/>
/// <reference path="./runtime/Function.ts"/>
/// <reference path="./runtime/Format.ts"/>
/// <reference path="./runtime/Join.ts"/>
/// <reference path="./runtime/Loop.ts"/>
/// <reference path="./runtime/Match.ts"/>
/// <reference path="./runtime/Import.ts"/>

"use strict";

namespace Fate.Runtime {
  export import isObject = Types.isObject;
  export let isTrue = Types.isTrue;
  export let isFalse = Types.isFalse;
  export let isIn = Types.isIn;
  export let isArray = Array.isArray;
}
