/** @flow */

import { Readable, Writable } from 'stream';
import { definePattern } from '../runtime';

const math = Math;
const object = Object;
const string = String;
const number = Number;
const timeout = setTimeout;
const json = JSON;

const Undefined = undefined;
const Null = null;

function make(Ctor: Function, ...args: any[]) {
  return new Ctor(...args);
}

function isA(type: string): Function {
  // eslint-disable-next-line valid-typeof
  return definePattern((value: any) => typeof value === type);
}

type Target = { [index: string]: any };

function setProperty(target: Target, key: string, value: any) {
  // eslint-disable-next-line no-param-reassign
  target[key] = value;
  return value;
}

function print(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}

export {
  math as Math,
  object as Object,
  string as String,
  number as Number,
  json as JSON,
  timeout,
  make,
  isA,
  setProperty,
  print,
  Undefined as undefined,
  Null as null,
  Readable,
  Writable,
};
