/** @flow */

export interface Annotated {
  annotations: Annotations;
}

export class Annotations {}

export function annotate(node: Annotated, name: string, value?: any) {
  let { annotations } = node;
  if (!annotations) {
    annotations = new Annotations();
    node.annotations = annotations;
  }
  annotations[name] = value === undefined ? true : value;
}

export function getAnnotation(node: Annotated, name: string) {
  const { annotations } = node;
  if (!annotations) {
    return false;
  }
  return annotations[name];
}

export function hasAnnotation(node: Annotated, name: string) {
  return !!getAnnotation(node, name);
}
