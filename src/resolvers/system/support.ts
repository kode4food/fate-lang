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
  isA
};

function isA(value: any, type: string): boolean {
  return typeof value === type;
}
