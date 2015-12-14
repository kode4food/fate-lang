"use strict";

const isArray = Array.isArray;

type Matcher = (value: any) => boolean;
type Matchers = Matcher[];

type AnyMap = { [index: string]: any };

export interface Pattern {
  (obj: any): boolean;
  __fatePattern?: boolean;
}

export function definePattern(value: Pattern) {
  value.__fatePattern = true;
  return value;
}

export function defineRegexPattern(regex: RegExp) {
  (<Pattern>pattern).__fatePattern = true;
  return pattern;

  function pattern(value: any) {
    return regex.test(value);
  }
}

export function isPattern(value: any) {
  return typeof value === 'function' && value.__fatePattern;
}

export let isNothing: Pattern = definePattern(function(value: any) {
  return value === null || value === undefined || value === isNothing;
});

export let isSomething: Pattern = definePattern(function(value: any) {
  return value !== null && value !== undefined && value !== isNothing;
});

/**
 * Basic dynamic matcher to support the `like` operator.
 */
export function isMatch(template: any, obj: any) {
  if ( isNothing(template) ) {
    return isNothing(obj);
  }

  if ( typeof template !== 'object' ) {
    if ( isPattern(template) ) {
      return template(obj);
    }
    return template === obj;
  }

  if ( isArray(template) ) {
    if ( !isArray(obj) || obj.length < template.length ) {
      return false;
    }

    for ( let i = 0, len = template.length; i < len; i++ ) {
      if ( !isMatch(template[i], obj[i]) ) {
        return false;
      }
    }

    return true;
  }

  if ( typeof obj !== 'object' || obj === null ) {
    return false;
  }

  for ( let key in template ) {
    if ( !isMatch(template[key], obj[key]) ) {
      return false;
    }
  }
  return true;
}

/**
 * Compiled matcher, for when the template has been defined as a literal.
 */
export function buildMatcher(template: any) {
  return definePattern(nestedMatcher(template));
}

function nestedMatcher(template: any) {
  if ( typeof template !== 'object' ) {
    return valueMatcher;
  }
  if ( isArray(template) ) {
    return buildArrayMatcher(template);
  }
  return buildObjectMatcher(template);

  function valueMatcher(obj: any) {
    return template === obj;
  }
}

function buildArrayMatcher(template: any[]) {
  let matchers: Matchers = [];
  let mlen = template.length;

  for ( let i = 0; i < mlen; i++ ) {
    matchers.push(nestedMatcher(template[i]));
  }
  return arrayMatcher;

  function arrayMatcher(obj: any) {
    if ( template === obj ) {
      return true;
    }
    if ( !isArray(obj) || obj.length < mlen ) {
      return false;
    }
    for ( let i = 0; i < mlen; i++ ) {
      if ( !matchers[i](obj[i]) ) {
        return false;
      }
    }
    return true;
  }
}

function buildObjectMatcher(template: AnyMap) {
  let matchers: Matchers = [];
  let keys = Object.keys(template);
  let mlen = keys.length;

  for ( let i = 0; i < mlen; i++ ) {
    matchers.push(nestedMatcher(template[keys[i]]));
  }
  return objectMatcher;

  function objectMatcher(obj: any) {
    if ( typeof obj !== 'object' || obj === null ) {
      return false;
    }
    for ( let i = 0; i < mlen; i++ ) {
      if ( !matchers[i](obj[keys[i]]) ) {
        return false;
      }
    }
    return true;
  }
}
