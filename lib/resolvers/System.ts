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
    let resolver = createMemoryResolver();

    resolver.register('math', <any>(System.Math));
    resolver.register('list', <any>(System.List));
    resolver.register('string', <any>(System.String));

    delete resolver.register;
    delete resolver.unregister;

    return resolver;
  }
}
