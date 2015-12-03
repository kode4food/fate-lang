"use strict";

let NativeMath = Math;

namespace Fate.Resolvers.System.Math {
  let createRangeGenerator = require('../lib/generator').createRangeGenerator;

  function numberSort(left: number, right: number): number {
    return left - right;
  }

  // `range(start, end)` creates an integer range generator
  export function range(start: number, end: number) {
    return createRangeGenerator(start, end);
  }

  // `avg(value)` if an Array, returns the average (mathematical mean) of
  // value's elements
  export function avg(value: number[]) {
    if ( !Array.isArray(value) ) {
      return typeof value === 'number' ? value : NaN;
    }
    if ( value.length === 0 ) {
      return 0;
    }
    let r = 0, l = value.length;
    for ( let i = 0; i < l; r += value[i++] ) {
      // no-op
    }
    return r / l;
  }

  // `max(value)` if an Array, return the greatest value in it
  export function max(value: number[]) {
    if ( !Array.isArray(value) ) {
      return typeof value === 'number' ? value : NaN;
    }
    return NativeMath.max.apply(Math, value);
  }

  // `median(value)` if an Array, return the mathematical median of
  // value's elements
  export function median(value: number[]) {
    if ( !Array.isArray(value) ) {
      return typeof value === 'number' ? value : NaN;
    }
    if ( value.length === 0 ) {
      return 0;
    }
    let temp = value.slice(0).sort(numberSort);
    if ( temp.length % 2 === 0 ) {
      let mid = temp.length / 2;
      return (temp[mid - 1] + temp[mid]) / 2;
    }
    return temp[((temp.length + 1) / 2) - 1];
  }

  // `min(value)` if an Array, return the lowest value in it
  export function min(value: number[]) {
    if ( !Array.isArray(value) ) {
      return typeof value === 'number' ? value : NaN;
    }
    return NativeMath.min.apply(Math, value);
  }

  // `sum(value)` if an Array, return the mathematical sum of value's
  // elements
  export function sum(value: number[]) {
    if ( !Array.isArray(value) ) {
      return typeof value === 'number' ? value : NaN;
    }
    let res = 0;
    for ( let i = 0, l = value.length; i < l; res += value[i++] ) {
      // no-op
    }
    return res;
  }

  // Math functions

  // `number(value)` convert value to a Number
  export let number = Number;
  // `abs(value)` returns the absolute value
  export let abs = NativeMath.abs;
  // `acos(value)` returns the arc-cosine of value (in radians)
  export let acos = NativeMath.acos;
  // `asin(value)` returns the arc-sine of value (in radians)
  export let asin = NativeMath.asin;
  // `atan(value)` returns the arc-tangent of value (in radians)
  export let atan = NativeMath.atan;
  // `atan2(x,y)` returns the arc-tangent of the coords
  export let atan2 = NativeMath.atan2;
  // `ceil(value)` rounds to the next highest integer
  export let ceil = NativeMath.ceil;
  // `cos(value)` returns the cosine of value (in radians)
  export let cos = NativeMath.cos;
  // `exp(x)` returns E to the power of x
  export let exp = NativeMath.exp;
  // `floor(value)` rounds to the next lowest integer
  export let floor = NativeMath.floor;
  // `log(value)` returns the natural logarithm
  export let log = NativeMath.log;
  // `pow(x,y)` returns x raised to the power of y
  export let pow = NativeMath.pow;
  // `random()` returns a random number (0 <= x < 1)
  export let random = NativeMath.random;
  // `round(value)` rounds up or down to the closest integer
  export let round = NativeMath.round;
  // `sin(value)` returns the sine of value (in radians)
  export let sin = NativeMath.sin;
  // `sqrt(value)` returns the square root
  export let sqrt = NativeMath.sqrt;
  // `tan(value)` returns the tangent of value (in radians)
  export let tan = NativeMath.tan;

  // ### Constants

  // `E` is Euler's Number
  export let E = NativeMath.E;
  // `LN2` is the Natural Logarithm of 2
  export let LN2 = NativeMath.LN2;
  // `LN10` is the Natural Logarithm of 10
  export let LN10 = NativeMath.LN10;
  // `LOG2E` is the Base-2 Logarithm of E
  export let LOG2E = NativeMath.LOG2E;
  // `LOG10E` is the Base-10 Logarithm of E
  export let LOG10E = NativeMath.LOG10E;
  // `PI` is Pi
  export let PI = NativeMath.PI;
  // `SQRT1_2` is the Square Root of 1/2
  export let SQRT1_2 = NativeMath.SQRT1_2;
  // `SQRT2` is the Square Root of 2
  export let SQRT2 = NativeMath.SQRT2;
}
