/** @flow */

type Component = [number, string|number];

interface FormatFunction {
  (data: any|any[]): string;
  __fate: string;
  __fateIndexes: (string|number)[];
}

const Digits = "0|[1-9][0-9]*";
const Ident = "[$_a-zA-Z][$_a-zA-Z0-9]*";
const Term = ";?";
const Params = `%((%)|(${Digits})|(${Ident}))?${Term}`;
               /* "%" ( "%" | digits | identifier )? ";"? */

const ParamRegex = new RegExp(Params, "m");

export function isFormatter(value: string) {
  if ( !ParamRegex.test(value) ) {
    return false;
  }
  return buildFormatter(value).__fateIndexes.length > 0;
}

/*
 * Builds a closure that will be used internally to support Fate's
 * interpolation operations.  The returned closure will attach flags
 * that identify any names or indexes that must be provided by Fate
 * to fulfill its formatting.
 */
export function buildFormatter(formatStr: string): FormatFunction {
  let components: Component[] = [];
  let requiredIndexes: (number|string)[] = [];
  let clen = 0;
  let autoIdx = 0;

  let workStr = '' + formatStr;
  while ( workStr && workStr.length ) {
    let paramMatch = ParamRegex.exec(workStr);
    if ( !paramMatch ) {
      components.push(createLiteralComponent(workStr));
      break;
    }

    let match = paramMatch[0];
    let matchIdx = paramMatch.index;
    let matchLen = match.length;

    if ( matchIdx ) {
      components.push(createLiteralComponent(workStr.substring(0, matchIdx)));
    }

    if ( paramMatch[2] === '%' ) {
      components.push(createLiteralComponent('%'));
      workStr = workStr.substring(matchIdx + matchLen);
      continue;
    }

    let idx: (string|number) = autoIdx++;
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

  formatFunction.toString = toString;
  formatFunction.__fate = 'format';
  formatFunction.__fateIndexes = requiredIndexes;
  return formatFunction;

  function toString() {
    return formatStr;
  }

  function formatFunction(data: any|any[]) {
    if ( typeof data !== 'object' || data === null ) {
      data = [data];
    }

    let result = '';
    for ( let i = 0; i < clen; i++ ) {
      let component = components[i];
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
