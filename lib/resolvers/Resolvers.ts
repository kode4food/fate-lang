/// <reference path="./Node.ts"/>
/// <reference path="./File.ts"/>
/// <reference path="./Memory.ts"/>
/// <reference path="./System.ts"/>

"use strict";

namespace Fate.Resolvers {
  export interface Resolver {
    resolve(name: Types.ModuleName, basePath?: Types.DirPath): Types.Module;
  }
}
