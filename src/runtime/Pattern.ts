"use strict";

// Partially borrowed from the ES6 Typings ************************************

interface WeakMap<K, V> {
  get(key: K): V;
  set(key: K, value?: V): WeakMap<K, V>;
}

interface WeakMapConstructor {
  new <K, V>(): WeakMap<K, V>;
}

declare var WeakMap: WeakMapConstructor;

// ****************************************************************************

type Matcher = (value: any) => boolean;
type Matchers = Matcher[];

type AnyMap = { [index: string]: any };

export interface Pattern {
  (obj: any): boolean;
  __fate?: string;
  native?: RegExp;
}

export function isPattern(value: any) {
  return typeof value === 'function' && value.__fate === 'pattern';
}

export const isArray: Pattern = definePattern(Array.isArray);

export const isObject: Pattern = definePattern((value: any) =>
  typeof value === 'object' && value !== null && !isArray(value)
);

export const isFalse: Pattern = definePattern((value: any) =>
  value === false || value === null || value === undefined
);

export const isTrue: Pattern = definePattern((value: any) =>
  value !== false && value !== null && value !== undefined
);

export let isNothing: Pattern = definePattern((value: any) =>
  value === null || value === undefined || value === isNothing
);

export let isSomething: Pattern = definePattern((value: any) =>
  value !== null && value !== undefined && value !== isNothing
);

export function matchNotExhaustive() {
  throw new Error("Match invocation not exhaustive");
}

function coerceBooleanResult(pattern: Pattern) {
  return wrapped;

  function wrapped(value: any): boolean {
    let result: any = pattern(value);
    return result !== false && result !== null && result !== undefined;
  }
}

export function definePattern(pattern: Pattern) {
  let wrapped = coerceBooleanResult(pattern);
  (<Pattern>wrapped).__fate = 'pattern';
  return wrapped;
}

const CachedTrue = "true";
const CachedFalse = "false";

export function defineCachedPattern(pattern: Pattern) {
  let wrapped = coerceBooleanResult(pattern);
  let cache = new WeakMap<Object, string>();
  (<Pattern>caching).__fate = 'pattern';
  return caching;

  function caching(value: any): boolean {
    if ( typeof value !== 'object' || value === null ) {
      return wrapped(value);
    }

    let cached = cache.get(value);
    if ( cached ) {
      return cached === CachedTrue;
    }

    let result = wrapped(value);
    cache.set(value, result ? CachedTrue : CachedFalse);
    return result;
  }
}

export function defineRegexPattern(regex: RegExp) {
  (<Pattern>wrapped).__fate = 'pattern';
  (<Pattern>wrapped).native = regex;
  return wrapped;

  function wrapped(value: any): boolean {
    return regex.test(value);
  }
}

/*
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
    /* istanbul ignore next: don't know where this template's been */
    if ( !template.hasOwnProperty(key) ) {
      continue;
    }
    if ( !isMatch(template[key], obj[key]) ) {
      return false;
    }
  }
  return true;
}

/*
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
