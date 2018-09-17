/** @flow */

import type { Evaluator } from './evaluator';

import * as Syntax from '../syntax';
import { NodeEvaluator } from './evaluator';

type FunctionMap = { [index: string]: Function };

export class LetEvaluator extends NodeEvaluator {
  static tags = ['let'];
  node: Syntax.LetStatement;

  constructor(parent: Evaluator, node: Syntax.LetStatement) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    this.node.assignments.forEach((assignment) => {
      this.dispatch(assignment);
    });
  }
}

export class AssignmentEvaluator extends NodeEvaluator {
  static tags = ['assignment', 'arrayDestructure', 'objectDestructure'];
  node: Syntax.Assignment;

  constructor(parent: Evaluator, node: Syntax.Assignment) {
    super(parent);
    this.node = node;
  }

  evaluate(getValue?: Function) {
    if (!getValue) {
      getValue = this.getAssignmentValue.bind(this);
    }

    const AssignmentEvaluators: FunctionMap = {
      assignment: this.createDirectAssignmentEvaluator,
      arrayDestructure: this.createArrayDestructureEvaluator,
      objectDestructure: this.createObjectDestructureEvaluator,
    };

    const assignmentEvaluator = AssignmentEvaluators[this.node.tag];
    return assignmentEvaluator.call(this, getValue);
  }

  getAssignmentValue() {
    return this.defer(this.node.value);
  }

  createDirectAssignmentEvaluator(getValue: Function) {
    const thisNode = this.node;
    this.coder.assignment(thisNode.id.value, getValue());
  }

  createArrayDestructureEvaluator(getValue: Function) {
    const thisNode = this.node;
    const result = this.coder.createAnonymous();

    this.coder.statement(() => {
      this.coder.assignAnonymous(result, getValue(thisNode));
    });

    thisNode.getIdentifiers().forEach((id, index) => {
      if (id instanceof Syntax.Wildcard) {
        return;
      }
      this.coder.assignment(id.value, () => {
        this.coder.member(
          () => { this.coder.retrieveAnonymous(result); },
          this.coder.literal(index),
        );
      });
    });
  }

  createObjectDestructureEvaluator(getValue: Function) {
    const thisNode = this.node;
    const result = this.coder.createAnonymous();

    this.coder.statement(() => {
      this.coder.assignAnonymous(result, getValue(thisNode));
    });

    thisNode.items.forEach((item) => {
      this.coder.assignment(item.id.value, () => {
        this.coder.member(
          () => { this.coder.retrieveAnonymous(result); },
          this.defer(item.value),
        );
      });
    });
  }
}
