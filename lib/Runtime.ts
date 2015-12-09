/// <reference path="./Types.ts"/>
/// <reference path="./runtime/Function.ts"/>
/// <reference path="./runtime/Format.ts"/>
/// <reference path="./runtime/Join.ts"/>
/// <reference path="./runtime/Loop.ts"/>
/// <reference path="./runtime/Match.ts"/>
/// <reference path="./runtime/Import.ts"/>

"use strict";

namespace Fate.Runtime {
  export const isArray = Array.isArray;

  export import isObject = Types.isObject;
  export import isTrue = Types.isTrue;
  export import isFalse = Types.isFalse;
  export import isIn = Types.isIn;
}
