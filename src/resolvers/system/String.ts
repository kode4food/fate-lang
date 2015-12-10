"use strict";

import { buildFormatter } from '../../runtime/Format';

// `build(value, supportFunctions)` converts the provided string and
// supportFunctions Object into a Fate interpolation function.
export function build(value: string) {
  return buildFormatter(value);
}

// `lower(value)` converts the provided string to lower-case and returns
// the result.
export function lower(value: string) {
  return ('' + value).toLowerCase();
}

// `split(value, delim)` splits the provided string wherever the
// specified delimiter (or whitespace) is encountered and returns the
// result.
export function split(value: string, delim?: RegExp) {
  if ( delim === undefined ) {
    delim = /\s*/;
  }
  return ('' + value).split(delim);
}

// `title(value)` converts the provided string to title-case and returns
// the result.  Title case converts the first character of each word to
// upper-case, and the rest to lower-case.
export function title(value: string) {
  return ('' + value).replace(/\w\S*/g, function (word) {
    return word.charAt(0).toUpperCase() + word.substr(1).toLowerCase();
  });
}

// `upper(value)` converts the provided string to upper-case and returns
// the result.
export function upper(value: string) {
  return ('' + value).toUpperCase();
}

// `string(value)` converts value to a String
export let string = String;
