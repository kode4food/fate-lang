"use strict";

import * as Syntax from '../syntax';
import { NodeEvaluator } from './Evaluator';
import { LetEvaluator } from './AssignmentEvaluator';
import { StatementsEvaluator } from './BasicEvaluator';

export class ConditionalEvaluator extends NodeEvaluator {
  public static tags = ['conditional'];

  public evaluate(node: Syntax.ConditionalOperator) {
    this.coder.conditionalOperator(
      this.defer(node.condition),
      this.defer(node.trueResult),
      this.defer(node.falseResult)
    );
  }
}

abstract class IfGeneratingEvaluator extends NodeEvaluator {
  protected generateIf(condition: Function,
                       thenStatements: Syntax.Statements,
                       elseStatements: Syntax.Statements) {
    let thens = thenStatements.isEmpty() ? null : thenStatements;
    let elses = elseStatements.isEmpty() ? null : elseStatements;

    this.coder.ifStatement(
      condition,
      thens ? () => {
        let evaluator = new StatementsEvaluator(this);
        evaluator.evaluate(thens);
      } : null,
      elses ? () => {
        let evaluator = new StatementsEvaluator(this);
        evaluator.evaluate(elses);
      } : null
    );
  }
}

export class IfEvaluator extends IfGeneratingEvaluator {
  public static tags = ['if'];

  public evaluate(node: Syntax.IfStatement) {
    this.generateIf(
      this.defer(node.condition),
      node.thenStatements,
      node.elseStatements
    );
  }
}

export class IfLetEvaluator extends IfGeneratingEvaluator {
  public static tags = ['ifLet'];

  public evaluate(node: Syntax.IfLetStatement) {
    let some = this.coder.runtimeImport('isSomething');
    let letStatement = node.condition;
    new LetEvaluator(this).evaluate(letStatement);

    let assignments = letStatement.assignments;
    let conditions: string[] = [];
    assignments.forEach(assignment => {
      assignment.getIdentifiers().forEach(id => {
        conditions.push(this.coder.code(() => {
          this.coder.call(some, [() => {
            this.coder.getter(id.value);
          }]);
        }));
      });
    });

    this.generateIf(
      () => { this.coder.writeAndGroup(conditions); },
      node.thenStatements,
      node.elseStatements
    );
  }
}
