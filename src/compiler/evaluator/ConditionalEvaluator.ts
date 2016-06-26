"use strict";

import * as Syntax from '../syntax';
import { NodeEvaluator } from './Evaluator';
import { LetEvaluator } from './AssignmentEvaluator';
import { StatementsEvaluator } from './BasicEvaluator';

export class ConditionalEvaluator extends NodeEvaluator {
  public static tags = ['conditional'];
  public node: Syntax.ConditionalOperator;

  public evaluate() {
    this.coder.conditionalOperator(
      this.defer(this.node.condition),
      this.defer(this.node.trueResult),
      this.defer(this.node.falseResult)
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
      thens ? () => new StatementsEvaluator(this, thens).evaluate() : null,
      elses ? () => new StatementsEvaluator(this, elses).evaluate() : null
    );
  }
}

export class IfEvaluator extends IfGeneratingEvaluator {
  public static tags = ['if'];
  public node: Syntax.IfStatement;

  public evaluate() {
    this.generateIf(
      this.defer(this.node.condition),
      this.node.thenStatements,
      this.node.elseStatements
    );
  }
}

export class IfLetEvaluator extends IfGeneratingEvaluator {
  public static tags = ['ifLet'];
  public node: Syntax.IfLetStatement;

  public evaluate() {
    let some = this.coder.runtimeImport('isSomething');
    let letStatement = this.node.condition;
    new LetEvaluator(this, letStatement).evaluate();

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
      this.node.thenStatements,
      this.node.elseStatements
    );
  }
}
