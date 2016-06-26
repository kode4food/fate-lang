"use strict";

import * as Syntax from '../syntax';
import { Evaluator, NodeEvaluator } from './Evaluator';
import { Coder } from '../target';

import * as AssignmentEvaluators from './Assignment';
import * as BasicEvaluators from './Basic';
import * as ConcurrencyEvaluators from './Concurrency';
import * as ConditionalEvaluators from './Conditional';
import * as FunctionEvaluators from './Function';
import * as LoopEvaluators from './Looping';
import * as ModuleEvaluators from './Module';
import * as PatternEvaluators from './Pattern';

interface AnyMap {
  [index: string]: any;
}

interface NodeEvaluatorConstructorMap {
  [index: string]: new (parent: Evaluator, node: Syntax.Node) => NodeEvaluator;
}

const evaluatorModules = [
  AssignmentEvaluators, BasicEvaluators, ConditionalEvaluators,
  ConcurrencyEvaluators, FunctionEvaluators, LoopEvaluators,
  ModuleEvaluators, PatternEvaluators
];

export class DispatchEvaluator extends Evaluator {
  private constructors: NodeEvaluatorConstructorMap = {};

  constructor(public coder: Coder) {
    super();

    evaluatorModules.forEach((module: AnyMap) => {
      Object.keys(module)
            .map(key => module[key])
            .filter(isNodeEvaluator)
            .forEach(constructorFunction => {
              let tags = constructorFunction.tags;
              tags.forEach((tag: string) => {
                this.constructors[tag] = constructorFunction;
              });
            });
    });

    function isNodeEvaluator(module: any) {
      return typeof module === 'function' && module.hasOwnProperty('tags');
    }
  }

  public evaluate(node: Syntax.Node, ...args: any[]) {
    /* istanbul ignore next: everything in the syntax tree is a node */
    if ( !(node instanceof Syntax.Node) ) {
      throw new Error("Stupid Coder: createEvaluator called without a Node");
    }

    let nodeType = node.tag;
    let EvaluatorConstructor = this.constructors[nodeType];

    /* istanbul ignore if: the tags should map properly to an evaluator */
    if ( !EvaluatorConstructor ) {
      throw new Error(`Stupid Coder: Invalid tag in Node: ${nodeType}`);
    }

    let instance = new EvaluatorConstructor(this, node);
    instance.evaluate.apply(instance, args);
  }

  public getRootEvaluator() {
    return this;
  }
}
