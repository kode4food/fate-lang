/** @flow */

import type { Resolver } from './index';
import type { Module, ModuleName } from '../fate';
import { isObject } from '../runtime';

import {
  compile, globals, isFateModule, createModule,
} from '../fate';


export type MemoryResolver = Resolver & {
  register(name: ModuleName, module: string | {}): void;
  unregister(name: ModuleName): void;
}

/*
 * Creates a new MemoryResolver.  As its name implies, this resolver
 * allows one to register a module to be stored in memory.  A default
 * instance of this resolver is used to store the System Modules.
 * Because of its flexibility, it can also be used to store custom
 * modules and native JavaScript helpers.
 */
export function createMemoryResolver(): MemoryResolver {
  const cache: { [index: string]: Module } = {};
  return { resolve, unregister, register };

  function resolve(name: ModuleName, basePath?: string): ?Module {
    const result = cache[name];
    if (!result) {
      return undefined;
    }
    return result;
  }

  /*
   * Removes a module from the resolver cache.
   */
  function unregister(name: ModuleName) {
    delete cache[name];
  }

  /*
   * Registers a module in the module cache.
   */
  function register(name: ModuleName, module: string | {}) {
    // A compiled Fate Module function
    if (isFateModule(module)) {
      cache[name] = (module: any);
      return;
    }

    // *String* - An unparsed Fate script
    if (typeof module === 'string') {
      const compiled = compile(module);
      const generatedModule = createModule();
      compiled(globals(), generatedModule.exports);
      cache[name] = generatedModule;
      return;
    }

    // *Object* - A hash of Helpers (name->Function)
    if (isObject(module)) {
      cache[name] = createModule(module);
      return;
    }

    throw new Error('Module not provided');
  }
}
