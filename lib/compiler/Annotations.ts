"use strict";

namespace Fate.Compiler {
  export interface Annotated {
    annotations: Annotations;
  }

  export class Annotations {
    [index: string]: any;
  }

  export function annotate(node: Annotated, name: string, value?: any) {
    var annotations = node.annotations;
    if ( !annotations ) {
      node.annotations = annotations = new Annotations();
    }
    annotations[name] = value === undefined ? true : value;
  }

  export function hasAnnotation(node: Annotated, name: string, value?: any) {
    var annotations = node.annotations;
    if ( !annotations ) {
      return false;
    }
    if ( value === undefined ) {
      return annotations[name];
    }
    return annotations[name] === value;
  }
}
