/** @flow */

import * as Syntax from '../syntax';
import { Evaluator, NodeEvaluator } from './evaluator';
import { Coder } from '../target';

import * as AssignmentEvaluators from './assignment';
import * as BasicEvaluators from './basic';
import * as ConcurrencyEvaluators from './concurrency';
import * as ConditionalEvaluators from './conditional';
import * as FunctionEvaluators from './function';
import * as LoopEvaluators from './looping';
import * as ModuleEvaluators from './module';
import * as PatternEvaluators from './pattern';

interface AnyMap {
  [index: string]: any;
}

interface NodeEvaluatorConstructorMap {
  [index: string]: (parent: Evaluator, node: Syntax.Node) => NodeEvaluator;
}

const evaluatorModules = [
  AssignmentEvaluators,
  BasicEvaluators,
  ConditionalEvaluators,
  ConcurrencyEvaluators,
  FunctionEvaluators,
  LoopEvaluators,
  ModuleEvaluators,
  PatternEvaluators,
];

export class DispatchEvaluator implements Evaluator {
  constructor(coder: Coder) {
    this.coder = coder;
    this.ctors = {};

    evaluatorModules.forEach((module: AnyMap) => {
      Object.keys(module)
        .map(key => module[key])
        .filter(isNodeEvaluator)
        .forEach((constructorFunction) => {
          const tags = constructorFunction.tags;
          tags.forEach((tag: string) => {
            this.ctors[tag] = constructorFunction;
          });
        });
    });

    function isNodeEvaluator(module: any) {
      return typeof module === 'function' && module.hasOwnProperty('tags');
    }
  }

  evaluate(node: Syntax.Node, ...args: any[]): void {
    if (!(node instanceof Syntax.Node)) {
      throw new Error('Stupid Coder: createEvaluator called without a Node');
    }

    const nodeType = node.tag;
    const EvaluatorConstructor = this.ctors[nodeType];

    if (!EvaluatorConstructor) {
      throw new Error(`Stupid Coder: Invalid tag in Node: ${nodeType}`);
    }

    const instance = new EvaluatorConstructor(this, node);
    instance.evaluate(...args);
  }

  getDispatchEvaluator() {
    return this;
  }
}
