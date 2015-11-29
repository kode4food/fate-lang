/// <reference path="../Types.ts"/>

"use strict";

namespace Fate.Resolvers {
  import createModule = Types.createModule;

  export function createNodeResolver() {
    return {
      resolve: resolve
    };

    function resolve(name: Types.ModuleName) {
      try {
        return createModule(require(name));
      }
      catch ( err ) {
        return undefined;
      }
    }
  }
}
