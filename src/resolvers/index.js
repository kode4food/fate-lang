/** @flow */

import type { ModuleName, DirPath, Module } from '../fate';

export type Resolver = {
  resolve(name: ModuleName, basePath?: DirPath): ?Module;
}

export * from './node';
export * from './file';
export * from './memory';
export * from './system';
