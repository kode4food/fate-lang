namespace Fate.Runtime {
  export type Collection = any[]|any|Function;

  var generator = require('../lib/generator');
  var isGenerator = generator.isGenerator;
  var generateIndexedSet = generator.generateIndexedSet;

  var EmptyCollection: Collection = [];

  export function createIterator(collection: Collection) {
    if ( Array.isArray(collection) || isObject(collection) ||
         isGenerator(collection) ) {
      return collection;
    }
    return EmptyCollection;
  }

  export function createNamedIterator(collection: Collection) {
    if ( Array.isArray(collection) ) {
      return collection.map(function (item: any, index: number) {
        return [item, index];
      });
    }
    if ( isObject(collection) ) {
      return Object.keys(collection).map(function (key) {
        return [collection[key], key];
      });
    }
    if ( isGenerator(collection) ) {
      return generateIndexedSet(collection);
    }
    return EmptyCollection;
  }
}
