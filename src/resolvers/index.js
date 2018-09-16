/** @flow */

import { ModuleName, DirPath, Module } from '../fate';

export interface Resolver {
  resolve(name: ModuleName, basePath?: DirPath): Module;
}

export * from './node';
export * from './file';
export * from './memory';
export * from './system';
