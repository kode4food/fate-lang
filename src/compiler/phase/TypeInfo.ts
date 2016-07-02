/// <reference path="../../../typings/main.d.ts" />

"use strict";

import { v4 as uuid } from 'node-uuid';

import * as Syntax from '../syntax';
import { Visitor, getAnnotation, annotate } from '../syntax';
import { isArray } from '../../runtime';

type Type = string;

function addTypeEntry(typeKey: string, node: Syntax.Node, type: Type) {
  let types = getAnnotation(node, typeKey);
  if ( !types ) {
    annotate(node, typeKey, types = []);
  }
  if ( types.indexOf(type) === -1 ) {
    types.push(type);
  }
  return node;
}

const addEvalType = addTypeEntry.bind(null, 'types/eval');
const addCallType = addTypeEntry.bind(null, 'types/call');

export default function createTreeProcessors(visit: Visitor) {
  return [
    visit.byTag({
      'literal': visitLiteral,
      'regex': visitPattern,
      'pattern': visitPattern
    })
  ];

  function visitLiteral(node: Syntax.Literal) {
    let value = node.value;
    let type = typeof value;
    if ( type === 'object' && isArray(value) ) {
      type = 'array';
    }
    addEvalType(node, type);
    return node;
  }

  function visitPattern(node: Syntax.Node) {
    addEvalType(node, 'pattern');
    addEvalType(node, 'pattern:' + uuid());
    addCallType(node, 'boolean');
    return node;
  }
}
