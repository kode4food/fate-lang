/** @flow */

import * as Syntax from '../syntax';
import { NodeEvaluator } from './evaluator';

type FunctionMap = { [index: string]: Function };

export class LetEvaluator extends NodeEvaluator {
  node: Syntax.LetStatement;

  evaluate() {
    this.node.assignments.forEach(assignment => {
      this.dispatch(assignment);
    });
  }
}
LetEvaluator.tags = ['let'];

export class AssignmentEvaluator extends NodeEvaluator {
  node: Syntax.Assignment;

  evaluate(getValue?: Function) {
    if (!getValue) {
      getValue = this.getAssignmentValue.bind(this);
    }

    let AssignmentEvaluators: FunctionMap = {
      'assignment': this.createDirectAssignmentEvaluator,
      'arrayDestructure': this.createArrayDestructureEvaluator,
      'objectDestructure': this.createObjectDestructureEvaluator
    };

    let assignmentEvaluator = AssignmentEvaluators[this.node.tag];
    return assignmentEvaluator.call(this, getValue);
  }

  getAssignmentValue() {
    return this.defer(this.node.value);
  }

  createDirectAssignmentEvaluator(getValue: Function) {
    let thisNode = this.node;
    this.coder.assignment(thisNode.id.value, getValue());
  }

  createArrayDestructureEvaluator(getValue: Function) {
    let thisNode = this.node;
    let result = this.coder.createAnonymous();

    this.coder.statement(() => {
      this.coder.assignAnonymous(result, getValue(thisNode));
    });

    thisNode.getIdentifiers().forEach((id, index) => {
      if ( id instanceof Syntax.Wildcard ) {
        return;
      }
      this.coder.assignment(id.value, () => {
        this.coder.member(
          () => { this.coder.retrieveAnonymous(result); },
          this.coder.literal(index)
        );
      });
    });
  }

  createObjectDestructureEvaluator(getValue: Function) {
    let thisNode = this.node;
    let result = this.coder.createAnonymous();

    this.coder.statement(() => {
      this.coder.assignAnonymous(result, getValue(thisNode));
    });

    thisNode.items.forEach(item => {
      this.coder.assignment(item.id.value, () => {
        this.coder.member(
          () => { this.coder.retrieveAnonymous(result); },
          this.defer(item.value)
        );
      });
    });
  }
}
AssignmentEvaluator.tags = ['assignment', 'arrayDestructure',
                            'objectDestructure'];
