"use strict";

namespace Fate.Runtime {
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

  export let none: Pattern = definePattern(function(value: any) {
    return value === null || value === undefined || value === none;
  });

  export let isNone = none;

  export let some = definePattern(function(value: any) {
    return value !== null && value !== undefined && value !== none;
  });

  export let isSome = some;

  /**
   * Basic Object Matcher to support the `like` operator.
   */
  export function isMatchingObject(template: any, obj: any) {
    if ( isNone(template) ) {
      return isNone(obj);
    }

    if ( typeof template !== 'object' ) {
      if ( isPattern(template) ) {
        return template(obj);
      }
      return template === obj;
    }

    if ( Array.isArray(template) ) {
      if ( !Array.isArray(obj) || obj.length < template.length ) {
        return false;
      }

      for ( let i = 0, len = template.length; i < len; i++ ) {
        if ( !isMatchingObject(template[i], obj[i]) ) {
          return false;
        }
      }

      return true;
    }

    if ( typeof obj !== 'object' || obj === null ) {
      return false;
    }

    for ( let key in template ) {
      if ( !isMatchingObject(template[key], obj[key]) ) {
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
    if ( Array.isArray(template) ) {
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
      if ( !Array.isArray(obj) || obj.length < mlen ) {
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
}
