"use strict";

const Promise = require('welsh').Promise;

const math = Math;
const object = Object;
const string = String;
const number = Number;

export {
  math as Math,
  object as Object,
  string as String,
  number as Number,
  createPromise,
  isA
};

function createPromise(executor: Function) {
  return new Promise(executor);
}

function isA(value: any, type: string): boolean {
  return typeof value === type;
}
