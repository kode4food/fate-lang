/** @flow */

type Matcher = (value: any) => boolean;
type Matchers = Matcher[];

export type Pattern = {
  (obj: any): boolean;
  __fate?: string;
  native?: RegExp;
}

export const isPattern = definePattern(
  (value: any) => typeof value === 'function' && value.__fate === 'pattern',
);

export const isArray: Pattern = definePattern(Array.isArray);

export const isObject: Pattern = definePattern(
  (value: any) => typeof value === 'object' && value !== null && !isArray(value),
);

export const isFalse: Pattern = definePattern(
  (value: any) => value === false || value === null || value === undefined,
);

export const isTrue: Pattern = definePattern(
  (value: any) => value !== false && value !== null && value !== undefined,
);

export const isNothing: Pattern = definePattern(
  (value: any) => value === null || value === undefined || value === isNothing,
);

export const isSomething: Pattern = definePattern(
  (value: any) => value !== null && value !== undefined && value !== isNothing,
);

export function matchNotExhaustive() {
  throw new Error('Match invocation not exhaustive');
}

function coerceBooleanResult(pattern: Pattern) {
  return wrapped;

  function wrapped(value: any): boolean {
    const result: any = pattern(value);
    return result !== false && result !== null && result !== undefined;
  }
}

export function definePattern(pattern: Pattern) {
  const wrapped = coerceBooleanResult(pattern);
  wrapped.__fate = 'pattern';
  return wrapped;
}

const CachedTrue = 'true';
const CachedFalse = 'false';

export function defineCachedPattern(pattern: Pattern) {
  const wrapped = coerceBooleanResult(pattern);
  const cache = new WeakMap();
  caching.__fate = 'pattern';
  return caching;

  function caching(value: any): boolean {
    if (typeof value !== 'object' || value === null) {
      return wrapped(value);
    }

    const cached = cache.get(value);
    if (cached) {
      return cached === CachedTrue;
    }

    const result = wrapped(value);
    cache.set(value, result ? CachedTrue : CachedFalse);
    return result;
  }
}

export function defineRegexPattern(regex: RegExp) {
  wrapped.__fate = 'pattern';
  wrapped.native = regex;
  return wrapped;

  function wrapped(value: any): boolean {
    return typeof value === 'string' && regex.test(value);
  }
}

/*
 * Basic dynamic matcher to support the `like` operator.
 */
export function isMatch(template: any, obj: any) {
  if (isNothing(template)) {
    return isNothing(obj);
  }

  if (typeof template !== 'object') {
    if (isPattern(template)) {
      return template(obj);
    }
    return template === obj;
  }

  if (isArray(template)) {
    if (!isArray(obj) || obj.length < template.length) {
      return false;
    }

    for (let i = 0, len = template.length; i < len; i += 1) {
      if (!isMatch(template[i], obj[i])) {
        return false;
      }
    }

    return true;
  }

  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  for (const key in template) {
    if (Object.prototype.hasOwnProperty.call(template, key)) {
      if (!isMatch(template[key], obj[key])) {
        return false;
      }
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
  if (typeof template !== 'object') {
    return valueMatcher;
  }
  if (isArray(template)) {
    return buildArrayMatcher(template);
  }
  return buildObjectMatcher(template);

  function valueMatcher(obj: any) {
    return template === obj;
  }
}

function buildArrayMatcher(template: any[]) {
  const matchers: Matchers = [];
  const mlen = template.length;

  for (let i = 0; i < mlen; i += 1) {
    matchers.push(nestedMatcher(template[i]));
  }
  return arrayMatcher;

  function arrayMatcher(obj: any) {
    if (template === obj) {
      return true;
    }
    if (!isArray(obj) || obj.length < mlen) {
      return false;
    }
    for (let i = 0; i < mlen; i += 1) {
      if (!matchers[i](obj[i])) {
        return false;
      }
    }
    return true;
  }
}

function buildObjectMatcher(template: {}) {
  const matchers: Matchers = [];
  const keys = Object.keys(template);
  const mlen = keys.length;

  for (let i = 0; i < mlen; i += 1) {
    matchers.push(nestedMatcher(template[keys[i]]));
  }
  return objectMatcher;

  function objectMatcher(obj: any) {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }
    for (let i = 0; i < mlen; i += 1) {
      if (!matchers[i](obj[keys[i]])) {
        return false;
      }
    }
    return true;
  }
}
