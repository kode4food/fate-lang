/** @flow */

import * as Syntax from '../syntax';
import { NodeEvaluator } from './evaluator';
import type { Evaluator } from './evaluator';

export class ConditionalEvaluator extends NodeEvaluator {
  static tags = ['conditional'];
  node: Syntax.ConditionalOperator;

  constructor(parent: Evaluator, node: Syntax.ConditionalOperator) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    this.coder.conditional(
      this.defer(this.node.condition),
      this.defer(this.node.trueResult),
      this.defer(this.node.falseResult),
    );
  }
}

class IfGeneratingEvaluator extends NodeEvaluator {
  generateIf(
    condition: Function,
    thenStatements: Syntax.Statements,
    elseStatements: Syntax.Statements,
  ) {
    const thens = thenStatements.isEmpty() ? null : thenStatements;
    const elses = elseStatements.isEmpty() ? null : elseStatements;

    this.coder.ifStatement(
      condition,
      thens ? () => { this.dispatch(thens); } : null,
      elses ? () => { this.dispatch(elses); } : null,
    );
  }
}

export class IfEvaluator extends IfGeneratingEvaluator {
  static tags = ['if'];
  node: Syntax.IfStatement;

  constructor(parent: Evaluator, node: Syntax.IfStatement) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    this.generateIf(
      this.defer(this.node.condition),
      this.node.thenStatements,
      this.node.elseStatements,
    );
  }
}

export class IfLetEvaluator extends IfGeneratingEvaluator {
  static tags = ['ifLet'];
  node: Syntax.IfLetStatement;

  constructor(parent: Evaluator, node: Syntax.IfLetStatement) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    const some = this.coder.runtimeImport('isSomething');
    const letStatement = this.node.condition;
    this.dispatch(letStatement);

    const { assignments } = letStatement;
    const conditions: string[] = [];
    assignments.forEach((assignment) => {
      assignment.getIdentifiers().forEach((id) => {
        conditions.push(
          this.coder.code(() => {
            this.coder.call(some, [
              () => {
                this.coder.getter(id.value);
              },
            ]);
          }),
        );
      });
    });

    this.generateIf(
      () => {
        this.coder.writeAndGroup(conditions);
      },
      this.node.thenStatements,
      this.node.elseStatements,
    );
  }
}
