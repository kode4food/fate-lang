/** @flow */

import * as Syntax from "../syntax";
import { NodeEvaluator } from "./evaluator";

export class ConditionalEvaluator extends NodeEvaluator {
  node: Syntax.ConditionalOperator;

  evaluate() {
    this.coder.conditional(
      this.defer(this.node.condition),
      this.defer(this.node.trueResult),
      this.defer(this.node.falseResult)
    );
  }
}
ConditionalEvaluator.tags = ["conditional"];

class IfGeneratingEvaluator extends NodeEvaluator {
  generateIf(
    condition: Function,
    thenStatements: Syntax.Statements,
    elseStatements: Syntax.Statements
  ) {
    let thens = thenStatements.isEmpty() ? null : thenStatements;
    let elses = elseStatements.isEmpty() ? null : elseStatements;

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
        : null
    );
  }
}

export class IfEvaluator extends IfGeneratingEvaluator {
  node: Syntax.IfStatement;

  evaluate() {
    this.generateIf(
      this.defer(this.node.condition),
      this.node.thenStatements,
      this.node.elseStatements
    );
  }
}
IfEvaluator.tags = ["if"];

export class IfLetEvaluator extends IfGeneratingEvaluator {
  node: Syntax.IfLetStatement;

  evaluate() {
    let some = this.coder.runtimeImport("isSomething");
    let letStatement = this.node.condition;
    this.dispatch(letStatement);

    let assignments = letStatement.assignments;
    let conditions: string[] = [];
    assignments.forEach(assignment => {
      assignment.getIdentifiers().forEach(id => {
        conditions.push(
          this.coder.code(() => {
            this.coder.call(some, [
              () => {
                this.coder.getter(id.value);
              }
            ]);
          })
        );
      });
    });

    this.generateIf(
      () => {
        this.coder.writeAndGroup(conditions);
      },
      this.node.thenStatements,
      this.node.elseStatements
    );
  }
}
IfLetEvaluator.tags = ["ifLet"];
