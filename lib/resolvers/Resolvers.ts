/// <reference path="./File.ts"/>
/// <reference path="./Memory.ts"/>
/// <reference path="./System.ts"/>

"use strict";

namespace Fate.Resolvers {
  export interface Resolver {
    resolveModule(name: Types.ModuleName): Types.Module;
    resolveExports(name: Types.ModuleName): Types.ModuleExports;
  }
}
