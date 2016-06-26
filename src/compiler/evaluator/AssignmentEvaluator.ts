"use strict";

import * as Syntax from '../syntax';
import { NodeEvaluator } from './Evaluator';

type FunctionMap = { [index: string]: Function };

export class LetEvaluator extends NodeEvaluator {
  public static tags = ['let'];

  public evaluate(node: Syntax.LetStatement) {
    node.assignments.forEach(assignment => {
      this.getRootEvaluator().evaluate(assignment);
    });
  }
}

export class AssignmentEvaluator extends NodeEvaluator {
  public static tags = ['assignment', 'arrayDestructure', 'objectDestructure'];

  public evaluate(node: Syntax.Assignment, getValue?: Function) {
    if ( !getValue ) {
      getValue = this.getAssignmentValue.bind(this);
    }

    let AssignmentEvaluators: FunctionMap = {
      'assignment': this.createDirectAssignmentEvaluator,
      'arrayDestructure': this.createArrayDestructureEvaluator,
      'objectDestructure': this.createObjectDestructureEvaluator
    };

    let assignmentEvaluator = AssignmentEvaluators[node.tag];
    return assignmentEvaluator.call(this, node, getValue);
  }

  private getAssignmentValue(node: Syntax.Assignment) {
    return this.defer(node.value);
  }

  private createDirectAssignmentEvaluator(node: Syntax.DirectAssignment,
                                          getValue: Function) {
    this.coder.assignment(node.id.value, getValue(node));
  }

  private createArrayDestructureEvaluator(node: Syntax.ArrayDestructure,
                                          getValue: Function) {
    let result = this.coder.createAnonymous();

    this.coder.statement(() => {
      this.coder.assignAnonymous(result, getValue(node));
    });

    node.getIdentifiers().forEach((id, index) => {
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

  private createObjectDestructureEvaluator(node: Syntax.ObjectDestructure,
                                           getValue: Function) {
    let result = this.coder.createAnonymous();

    this.coder.statement(() => {
      this.coder.assignAnonymous(result, getValue(node));
    });

    node.items.forEach(item => {
      this.coder.assignment(item.id.value, () => {
        this.coder.member(
          () => { this.coder.retrieveAnonymous(result); },
          this.defer(item.value)
        );
      });
    });
  }
}
