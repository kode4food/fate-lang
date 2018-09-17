/** @flow */

import * as Syntax from '../syntax';
import { NodeEvaluator } from './evaluator';

export class ConditionalEvaluator extends NodeEvaluator {
  static tags = ['conditional'];
  node: Syntax.ConditionalOperator;

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
      thens
        ? () => {
          this.dispatch(thens);
        }
        : null,
      elses
        ? () => {
          this.dispatch(elses);
        }
        : null,
    );
  }
}

export class IfEvaluator extends IfGeneratingEvaluator {
  static tags = ['if'];
  node: Syntax.IfStatement;

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

  evaluate(...args: any[]) {
    const some = this.coder.runtimeImport('isSomething');
    const letStatement = this.node.condition;
    this.dispatch(letStatement);

    const assignments = letStatement.assignments;
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
