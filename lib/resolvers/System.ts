/// <reference path="../Types.ts"/>
/// <reference path="../Fate.ts"/>
/// <reference path="./Memory.ts"/>
/// <reference path="./system/List.ts"/>
/// <reference path="./system/Math.ts"/>
/// <reference path="./system/String.ts"/>

"use strict";

namespace Fate.Resolvers {
  import createMemoryResolver = Resolvers.createMemoryResolver;

  export function createSystemResolver() {
    var resolver = createMemoryResolver();

    resolver.registerModule('math', <any>(System.Math));
    resolver.registerModule('list', <any>(System.List));
    resolver.registerModule('string', <any>(System.String));

    delete resolver.registerModule;
    delete resolver.unregisterModule;

    return resolver;
  }
}
