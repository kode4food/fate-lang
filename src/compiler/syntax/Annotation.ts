"use strict";

export interface Annotated {
  annotations: Annotations;
}

export class Annotations {
  [index: string]: any;
}

export function annotate(node: Annotated, name: string, value?: any) {
  let annotations = node.annotations;
  if ( !annotations ) {
    node.annotations = annotations = new Annotations();
  }
  annotations[name] = value === undefined ? true : value;
}

export function getAnnotation(node: Annotated, name: string) {
  let annotations = node.annotations;
  if ( !annotations ) {
    return false;
  }
  return annotations[name];
}

export function hasAnnotation(node: Annotated, name: string) {
  return !!getAnnotation(node, name);
}
