namespace Fate.Runtime {
  export type Collection = any[]|any|Function;

  export var stopIteration = {
    __fateStopIteration: true
  };

  export interface Generator {
    (): any;
    __fateGenerator?: boolean;
  }

  export function blessGenerator(value: Generator) {
    value.__fateGenerator = true;
    return value;
  }

  export function isFateGenerator(gen: any) {
    return typeof gen === 'function' && gen.__fateGenerator;
  }

  export function loop(collection: Collection, loopCallback: Function) {
    var i: number = 0;
    var len: number;
    var name: string|number;
    var value: any;

    if ( Array.isArray(collection) ) {
      for ( len = collection.length; i < len; i++ ) {
        value = collection[i];
        loopCallback(value === null ? undefined : value, i);
      }
      return;
    }

    if ( typeof collection === 'object' && collection !== null ) {
      var items = Object.keys(collection);
      for ( len = items.length; i < len; i++ ) {
        name = items[i];
        value = collection[name];
        loopCallback(value === null ? undefined : value, name);
      }
      return;
    }

    if ( isFateGenerator(collection) ) {
      for ( value = collection(); value !== stopIteration;
            value = collection() ) {
        loopCallback(value, i++);
      }
    }
  }
}
