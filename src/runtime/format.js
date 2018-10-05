/** @flow */

import { isObject, isArray } from './pattern';

type Component = [number, string | number];

export type FormatFunction = {
  (data: any | any[]): string;
  __fate: string;
  __fateIndexes: (string | number)[];
}

const digits = '0|[1-9][0-9]*';
const ident = '[$_a-zA-Z][$_a-zA-Z0-9]*';
const term = ';?';
const params = `%((%)|(${digits})|(${ident}))?${term}`;
const paramRegex = new RegExp(params, 'm');

export function isFormatter(value: string) {
  if (!paramRegex.test(value)) {
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
  const components: Component[] = [];
  const requiredIndexes: (number | string)[] = [];
  let clen = 0;
  let autoIdx = 0;

  let workStr = `${formatStr}`;
  while (workStr && workStr.length) {
    const paramMatch = paramRegex.exec(workStr);
    if (!paramMatch) {
      components.push(createLiteralComponent(workStr));
      break;
    }

    const match = paramMatch[0];
    const matchIdx = paramMatch.index;
    const matchLen = match.length;

    if (matchIdx) {
      components.push(createLiteralComponent(workStr.substring(0, matchIdx)));
    }

    if (paramMatch[2] === '%') {
      components.push(createLiteralComponent('%'));
      workStr = workStr.substring(matchIdx + matchLen);
    } else {
      let idx: (string | number) = autoIdx;
      autoIdx += 1;
      if (paramMatch[4]) {
        // eslint-disable-next-line prefer-destructuring
        idx = paramMatch[4];
      } else if (paramMatch[3]) {
        idx = parseInt(paramMatch[3], 10);
      }
      requiredIndexes.push(idx);
      components.push(createIndexedComponent(idx));
      workStr = workStr.substring(matchIdx + matchLen);
    }
  }
  clen = components.length;

  formatFunction.toString = toString;
  formatFunction.__fate = 'format';
  formatFunction.__fateIndexes = requiredIndexes;
  return formatFunction;

  function toString() {
    return formatStr;
  }

  function formatFunction(data: any) {
    let d = data;
    if (!isObject(d) && !isArray(d)) {
      d = [d];
    }

    let result = '';
    for (let i = 0; i < clen; i += 1) {
      const component = components[i];
      switch (component[0]) {
        case 0:
          result += component[1];
          break;
        case 1:
          result += d[(component[1]: any)];
          break;
        default:
          throw new Error('Stupid Coder: Default switch case');
      }
    }
    return result;
  }

  function createLiteralComponent(literal: string): Component {
    return [0, literal];
  }

  function createIndexedComponent(idx: number | string): Component {
    return [1, idx];
  }
}
