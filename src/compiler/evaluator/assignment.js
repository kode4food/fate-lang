/** @flow */

import type { Evaluator } from './evaluator';
import { NodeEvaluator } from './evaluator';
import * as Syntax from '../syntax';

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
  static tags = ['assignment'];
  node: Syntax.DirectAssignment;

  constructor(parent: Evaluator, node: Syntax.DirectAssignment) {
    super(parent);
    this.node = node;
  }

  evaluate(getValue: Function) {
    if (!getValue) {
      getValue = this.getAssignmentValue.bind(this);
    }
    this.coder.assignment(this.node.id.value, getValue());
  }

  getAssignmentValue() {
    return this.defer(this.node.value);
  }
}

export class ArrayDestructureEvaluator extends NodeEvaluator {
  static tags = ['arrayDestructure'];
  node: Syntax.ArrayDestructure;

  constructor(parent: Evaluator, node: Syntax.ArrayDestructure) {
    super(parent);
    this.node = node;
  }

  evaluate(getValue: Function) {
    if (!getValue) {
      getValue = this.getAssignmentValue.bind(this);
    }

    const result = this.coder.createAnonymous();
    const thisNode = this.node;
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

  getAssignmentValue() {
    return this.defer(this.node.value);
  }
}

export class ObjectDestructureEvaluator extends NodeEvaluator {
  static tags = ['objectDestructure'];
  node: Syntax.ObjectDestructure;

  constructor(parent: Evaluator, node: Syntax.ObjectDestructure) {
    super(parent);
    this.node = node;
  }

  evaluate(getValue: Function) {
    if (!getValue) {
      getValue = this.getAssignmentValue.bind(this);
    }
    const result = this.coder.createAnonymous();
    const thisNode = this.node;
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

  getAssignmentValue() {
    return this.defer(this.node.value);
  }
}
