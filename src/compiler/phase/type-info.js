/** @flow */

import { v4 as uuid } from 'uuid';

import * as Syntax from '../syntax';
import { isArray } from '../../runtime';

const { Visitor, getAnnotation, annotate } = Syntax;

type Type = string;

function addTypeEntry(typeKey: string, node: Syntax.Node, type: Type) {
  let types = getAnnotation(node, typeKey);
  if (!types) {
    annotate(node, typeKey, types = []);
  }
  if (types.indexOf(type) === -1) {
    types.push(type);
  }
  return node;
}

const addEvalType = addTypeEntry.bind(null, 'types/eval');
const addCallType = addTypeEntry.bind(null, 'types/call');

function createInstance(node: Syntax.Node, type: string) {
  const instance = `${type}:${uuid()}`;
  annotate(node, 'types/instance', instance);
  addEvalType(node, instance);
  return instance;
}

export default function createTreeProcessors(visit: Visitor) {
  return [
    visit.byTag({
      literal: visitLiteral,
      regex: visitPattern,
      pattern: visitPattern,
    }),
  ];

  function visitLiteral(node: Syntax.Literal) {
    const { value } = node;
    let type = typeof value;
    if (type === 'object' && isArray(value)) {
      type = 'array';
    }
    addEvalType(node, type);
    createInstance(node, type);
    return node;
  }

  function visitPattern(node: Syntax.Node) {
    addEvalType(node, 'pattern');
    addCallType(node, 'boolean');
    createInstance(node, 'pattern');
    return node;
  }
}
