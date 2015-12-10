"use strict";

import * as ArrayModule from './system/Array';
import * as MathModule from './system/Math';
import * as ObjectModule from './system/Object';
import * as PatternModule from './system/Pattern';
import * as StringModule from './system/String';

import { createMemoryResolver } from './Memory';

export function createSystemResolver() {
  let resolver = createMemoryResolver();

  resolver.register('array', ArrayModule);
  resolver.register('math', MathModule);
  resolver.register('object', ObjectModule);
  resolver.register('pattern', PatternModule);
  resolver.register('string', StringModule);

  delete resolver.register;
  delete resolver.unregister;

  return resolver;
}
