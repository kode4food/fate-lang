"use strict";

import * as Syntax from '../syntax';
import { Evaluator } from './Evaluator';
import { Coder } from '../target';

import * as AssignmentEvaluators from './AssignmentEvaluator';
import * as BasicEvaluators from './BasicEvaluator';
import * as ConditionalEvaluators from './ConditionalEvaluator';
import * as DoEvaluators from './DoEvaluator';
import * as FunctionEvaluators from './FunctionEvaluator';
import * as LoopEvaluators from './LoopEvaluator';
import * as ModuleEvaluators from './ModuleEvaluator';
import * as PatternEvaluators from './PatternEvaluator';

const evaluatorModules = [
  AssignmentEvaluators, BasicEvaluators, ConditionalEvaluators, DoEvaluators,
  FunctionEvaluators, LoopEvaluators, ModuleEvaluators, PatternEvaluators
];

interface AnyMap {
  [index: string]: any;
}

interface EvaluatorMap {
  [index: string]: Evaluator;
}

export class DispatchEvaluator extends Evaluator {
  private evaluators: EvaluatorMap = {};

  constructor(public coder: Coder) {
    super(null, coder);

    evaluatorModules.forEach((module: AnyMap) => {
      Object.keys(module).forEach(key => {
        let EvaluatorClass = module[key];
        /* istanbul ignore else: we only care about qualifying constructors */
        if ( typeof EvaluatorClass === 'function' &&
             EvaluatorClass.hasOwnProperty('tags') ) {
          let instance = new EvaluatorClass(this, coder);
          let tags = EvaluatorClass.tags;
          tags.forEach((tag: string) => {
            this.evaluators[tag] = instance;
          });
        }
      });
    });
  }

  public evaluate(node: Syntax.Node) {
    /* istanbul ignore next: everything in the syntax tree is a node */
    if ( !(node instanceof Syntax.Node) ) {
      throw new Error("Stupid Coder: createEvaluator called without a Node");
    }

    let nodeType = node.tag;
    let evaluator = this.evaluators[nodeType];

    /* istanbul ignore if: the tags should map properly to an evaluator */
    if ( !evaluator ) {
      throw new Error(`Stupid Coder: Invalid tag in Node: ${nodeType}`);
    }

    evaluator.evaluate(node);
  }
}
