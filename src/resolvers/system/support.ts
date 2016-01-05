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
  getTypeOf
};

function getTypeOf(value: any): string {
  return typeof value;
}
