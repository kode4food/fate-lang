"use strict";

import { ModuleName, DirPath, Module } from '../Fate';

export interface Resolver {
  resolve(name: ModuleName, basePath?: DirPath): Module;
}

export * from './Node';
export * from './File';
export * from './Memory';
export * from './System';
