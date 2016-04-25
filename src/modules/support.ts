"use strict";

const Promise = require('welsh').Promise;

const math = Math;
const object = Object;
const string = String;
const number = Number;

const Undefined: any = undefined;
const Null: any = null;

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

function print() {
  console.log.apply(console, arguments);
}

function mutable(value: any) {
  let result = {
    value: value,
    set: setMutable
  };

  return result;

  function setMutable(newValue: any) {
    result.value = newValue;
    return newValue;
  }
}

function timeout(delay: number) {
  return new Promise(function (resolve: Function) {
    setTimeout(function () {
      resolve(delay);
    }, delay);
  });
}

export {
  math as Math, object as Object, string as String, number as Number,
  make, isA, setProperty, print, mutable, timeout,
  Undefined as undefined, Null as null
};
