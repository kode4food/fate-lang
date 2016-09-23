"use strict";

import { definePattern } from '../runtime';
import { Readable, Writable } from 'stream';

const math = Math;
const object = Object;
const string = String;
const number = Number;
const timeout = setTimeout;
const json = JSON;

const Undefined: any = undefined;
const Null: any = null;

function make(constructor: Function, ...args: any[]) {
  let instance = Object.create(constructor.prototype);
  return constructor.apply(instance, args) || instance;
}

function isA(type: string): Function {
  return definePattern((value: any) => typeof value === type);
}

type Target = { [index: string]: any };

function setProperty(target: Target, key: string, value: any) {
  return target[key] = value;
}

function print() {
  console.log.apply(console, arguments);
}

export {
  math as Math, object as Object, string as String, number as Number,
  json as JSON, timeout, make, isA, setProperty, print,
  Undefined as undefined, Null as null, Readable, Writable
};
