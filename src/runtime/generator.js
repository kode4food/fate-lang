/** @flow */

// Checking for an already instantiated generator
export function isGenerator(value: any) {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  return typeof value.next === 'function' && value.next.length === 1;
}

export function* createRangeGenerator(start: number, end: number) {
  let current = Math.floor(start);
  start = current;
  end = Math.floor(end);
  const increment = end > start ? 1 : -1;
  let idx = 0;

  yield [current, idx++];
  while (current !== end) {
    current += increment;
    yield [current, idx++];
  }
}

export function* generateArray(array) {
  for (let i = 0; i < array.length; i++) {
    yield [array[i], i];
  }
}

export function* generateObject(object) {
  for (const key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      yield [object[key], key];
    }
  }
}

export function materializeArray(collection) {
  const result = [];
  let idx = 0;
  for (const item of collection) {
    // eslint-disable-next-line prefer-destructuring
    result[idx++] = item[0];
  }
  return result;
}

export function materializeObject(collection) {
  const result = {};
  for (const item of collection) {
    // eslint-disable-next-line prefer-destructuring
    result[item[1]] = item[0];
  }
  return result;
}
