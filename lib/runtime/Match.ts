/// <reference path="../Types.ts"/>

"use strict";

namespace Fate.Runtime {
  export interface Pattern {
    (obj: any): boolean;
    __fatePattern?: boolean;
  }

  export function definePattern(value: Pattern) {
    value.__fatePattern = true;
    return value;
  }

  export function isPattern(value: any) {
    return typeof value === 'function' && value.__fatePattern;
  }

  type Matcher = (value: any) => boolean;
  type Matchers = Matcher[];

  type AnyMap = { [index: string]: any };

  /**
   * Basic Object Matcher to support the `like` operator.
   *
   * @param {Mixed} template the Template to match against
   * @param {Mixed} obj the Object being inspected
   */
  export function isMatchingObject(template: any, obj: any) {
    if ( template === null || template === undefined ) {
      return obj === null || obj === undefined;
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

      for ( var i = 0, len = template.length; i < len; i++ ) {
        if ( !isMatchingObject(template[i], obj[i]) ) {
          return false;
        }
      }

      return true;
    }

    if ( typeof obj !== 'object' || obj === null ) {
      return false;
    }

    for ( var key in template ) {
      if ( !isMatchingObject(template[key], obj[key]) ) {
        return false;
      }
    }
    return true;
  }

  function nullMatcher(obj: any) {
    return obj === null || obj === undefined;
  }
  definePattern(nullMatcher);

  /**
   * Compiled matcher, for when the template has been defined as a literal.
   *
   * @param {Mixed} template the Template to match against
   */
  export function buildMatcher(template: any) {
    return definePattern(nestedMatcher(template));
  }

  function nestedMatcher(template: any) {
    if ( template === null || template === undefined ) {
      return nullMatcher;
    }
    if ( typeof template !== 'object' ) {
      if ( isPattern(template) ) {
        return template;
      }
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
    var matchers: Matchers = [];
    var mlen = template.length;

    for ( var i = 0; i < mlen; i++ ) {
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
      for ( var i = 0; i < mlen; i++ ) {
        if ( !matchers[i](obj[i]) ) {
          return false;
        }
      }
      return true;
    }
  }

  function buildObjectMatcher(template: AnyMap) {
    var matchers: Matchers = [];
    var keys = Object.keys(template);
    var mlen = keys.length;

    for ( var i = 0; i < mlen; i++ ) {
      matchers.push(nestedMatcher(template[keys[i]]));
    }
    return objectMatcher;

    function objectMatcher(obj: any) {
      if ( template === obj ) {
        return true;
      }
      if ( typeof obj !== 'object' || obj === null ) {
        return false;
      }
      for ( var i = 0; i < mlen; i++ ) {
        if ( !matchers[i](obj[keys[i]]) ) {
          return false;
        }
      }
      return true;
    }
  }
}
