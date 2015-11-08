"use strict";

namespace Fate.Runtime {
  type Component = [number, string|number];

  interface FormatFunction {
    (data: any | any[]): string;
    __fateIndexes: (string | number)[];
  }
  
  var Digits = "0|[1-9][0-9]*";
  var Ident = "[$_a-zA-Z][$_a-zA-Z0-9]*";
  var Term = ";?";
  var Params = "%((%)|(" + Digits + ")|(" + Ident + "))?" + Term;
               /* "%" ( "%" | digits | identifier )? ";"? */

  var ParamRegex = new RegExp(Params, "m");

  export function isFormatter(value: string) {
    if ( !ParamRegex.test(value) ) {
      return false;
    }
    return buildFormatter(value).__fateIndexes.length > 0;
  }

  /**
   * Builds a closure that will be used internally to support Fate's
   * interpolation operations.  The returned closure will attach flags
   * that identify any names or indexes that must be provided by Fate
   * to fulfill its formatting.
   *
   * @param {String} formatStr the String to be used for interpolation
   */
  export function buildFormatter(formatStr: string): FormatFunction {
    var components: Component[] = [];
    var requiredIndexes: (number|string)[] = [];
    var clen = 0;
    var autoIdx = 0;

    var workStr = '' + formatStr;
    while ( workStr && workStr.length ) {
      var paramMatch = ParamRegex.exec(workStr);
      if ( !paramMatch ) {
        components.push(createLiteralComponent(workStr));
        break;
      }

      var match = paramMatch[0];
      var matchIdx = paramMatch.index;
      var matchLen = match.length;

      if ( matchIdx ) {
        components.push(createLiteralComponent(workStr.substring(0, matchIdx)));
      }

      if ( paramMatch[2] === '%' ) {
        components.push(createLiteralComponent('%'));
        workStr = workStr.substring(matchIdx + matchLen);
        continue;
      }

      var idx: (string|number) = autoIdx++;
      if ( paramMatch[4] ) {
        idx = paramMatch[4];
      }
      else if ( paramMatch[3] ) {
        idx = parseInt(paramMatch[3], 10);
      }
      requiredIndexes.push(idx);
      components.push(createIndexedComponent(idx));

      workStr = workStr.substring(matchIdx + matchLen);
    }
    clen = components.length;

    var returnFunction = <FormatFunction>formatFunction;
    returnFunction.toString = toString;
    returnFunction.__fateIndexes = requiredIndexes;
    return returnFunction;

    function toString() {
      return formatStr;
    }

    function formatFunction(data: any|any[]) {
      if ( typeof data !== 'object' || data === null ) {
        data = [data];
      }

      var result = '';
      for ( var i = 0; i < clen; i++ ) {
        var component = components[i];
        switch ( component[0] ) {
          case 0:
            result += component[1];
            break;
          case 1:
            result += data[component[1]];
            break;
        }
      }
      return result;
    }

    function createLiteralComponent(literal: string): Component {
      return [0, literal];
    }

    function createIndexedComponent(idx: number|string): Component {
      return [1, idx];
    }
  }
}
