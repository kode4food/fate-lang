/// <reference path="../Types.ts"/>
/// <reference path="../Fate.ts"/>
/// <reference path="./Memory.ts"/>
/// <reference path="./system/Array.ts"/>
/// <reference path="./system/Object.ts"/>
/// <reference path="./system/Math.ts"/>
/// <reference path="./system/String.ts"/>
/// <reference path="./system/Pattern.ts"/>

"use strict";

namespace Fate.Resolvers {
  import createMemoryResolver = Resolvers.createMemoryResolver;

  export function createSystemResolver() {
    let resolver = createMemoryResolver();

    resolver.register('math', System.MathModule);
    resolver.register('array', System.ArrayModule);
    resolver.register('object', System.ObjectModule);
    resolver.register('string', System.StringModule);
    resolver.register('pattern', System.PatternModule);

    delete resolver.register;
    delete resolver.unregister;

    return resolver;
  }
}
