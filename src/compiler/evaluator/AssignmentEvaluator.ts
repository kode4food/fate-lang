"use strict";

import * as Syntax from '../syntax';
import { NodeEvaluator } from './Evaluator';

type FunctionMap = { [index: string]: Function };

export class LetEvaluator extends NodeEvaluator {
  public static tags = ['let'];
  public node: Syntax.LetStatement;

  public evaluate() {
    this.node.assignments.forEach(assignment => {
      this.getRootEvaluator().evaluate(assignment);
    });
  }
}

export class AssignmentEvaluator extends NodeEvaluator {
  public static tags = ['assignment', 'arrayDestructure', 'objectDestructure'];
  public node: Syntax.Assignment;

  public evaluate(getValue?: Function) {
    if ( !getValue ) {
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

  private getAssignmentValue() {
    return this.defer(this.node.value);
  }

  private createDirectAssignmentEvaluator(getValue: Function) {
    let thisNode = <Syntax.DirectAssignment>this.node;
    this.coder.assignment(thisNode.id.value, getValue());
  }

  private createArrayDestructureEvaluator(getValue: Function) {
    let thisNode = <Syntax.ArrayDestructure>this.node;
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

  private createObjectDestructureEvaluator(getValue: Function) {
    let thisNode = <Syntax.ObjectDestructure>this.node;
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
