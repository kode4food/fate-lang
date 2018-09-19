/** @flow */

export type Annotated = {
  annotations: Annotations;
}

export type Annotations = { [string]: any };

export function annotate(node: Annotated, name: string, value?: any) {
  const n = node;
  let { annotations } = n;
  if (!annotations) {
    annotations = {};
    n.annotations = annotations;
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
