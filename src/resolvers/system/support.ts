"use strict";

const math = Math;
const object = Object;
const string = String;
const number = Number;

export {
  math as Math,
  object as Object,
  string as String,
  number as Number,
  make,
  isA,
  setProperty
};

function make(constructor: Function, ...args: any[]) {
  let instance = Object.create(constructor.prototype);
  return constructor.apply(instance, args) || instance;
}

function isA(value: any, type: string): boolean {
  return typeof value === type;
}

type Target = { [index: string]: any };

function setProperty(target: Target, key: string, value: any) {
  target[key] = value;
}
