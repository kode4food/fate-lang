/** @flow */

import type { Evaluator } from './evaluator';
import * as Syntax from '../syntax';
import { NodeEvaluator } from './evaluator';

export class AwaitEvaluator extends NodeEvaluator {
  static tags = ['await'];
  node: Syntax.AwaitOperator;

  constructor(parent: Evaluator, node: Syntax.AwaitOperator) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    this.coder.waitFor(this.node.resolver, this.defer(this.node.left));
  }
}

export class DoEvaluator extends NodeEvaluator {
  static tags = ['do'];
  node: Syntax.DoExpression;

  constructor(parent: Evaluator, node: Syntax.DoExpression) {
    super(parent);
    this.node = node;
  }

  evaluate(caseGuard?: Function) {
    this.coder.call(this.coder.runtimeImport('createDoBlock'), [
      () => {
        this.coder.func({
          generator: true,
          body: () => {
            if (this.node.whenClause instanceof Syntax.LetStatement) {
              const { whenClause } = this.node;
              const groups = this.getAssignmentGroups(whenClause.assignments);
              groups.forEach(group => this.generateAssignment(group));
            } else if (this.node.whenClause) {
              this.generateExpression(this.node.whenClause);
            }

            if (caseGuard) {
              caseGuard();
            }

            this.dispatch(this.node.statements);
          },
        });
      },
    ]);
  }

  generateExpression(expression: Syntax.Expression) {
    this.coder.statement(() => {
      this.coder.assignResult(() => {
        this.coder.waitFor(Syntax.Resolver.Value, () => {
          this.dispatch(expression);
        });
      });
    });
  }

  // eslint-disable-next-line class-methods-use-this
  getAssignmentGroups(assignments: Syntax.Assignments) {
    const groups: Syntax.Assignments[] = [];

    assignments.forEach((assignment) => {
      const groupNum = Syntax.getAnnotation(assignment, 'when/group') || 0;
      const group = groups[groupNum] || (groups[groupNum] = []);
      group.push(assignment);
    });

    return groups;
  }

  generateAssignment(group: Syntax.Assignments) {
    const anon = this.coder.createAnonymous();
    this.coder.statement(() => {
      this.coder.assignAnonymous(anon, () => {
        this.coder.waitFor(Syntax.Resolver.All, () => {
          this.coder.array(
            group.map(assignment => this.defer(assignment.value)),
          );
        });
      });
    });

    group.forEach((assignment, index) => {
      this.dispatch(assignment, () => () => {
        this.coder.member(
          () => { this.coder.retrieveAnonymous(anon); },
          this.coder.literal(index),
        );
      });
    });
  }
}

export class CaseEvaluator extends NodeEvaluator {
  static tags = ['case'];
  node: Syntax.CaseExpression;

  constructor(parent: Evaluator, node: Syntax.CaseExpression) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    this.coder.call(this.coder.runtimeImport('createDoBlock'), [
      () => {
        this.coder.func({
          generator: true,
          body: () => {
            const triggered = this.coder.createAnonymous();

            this.coder.returnStatement(() => {
              this.coder.waitFor(Syntax.Resolver.Any, () => {
                this.coder.array(this.node.cases.map(
                  doCase => () => {
                    new DoEvaluator(this, doCase).evaluate(() => {
                      this.coder.ifStatement(
                        () => { this.coder.retrieveAnonymous(triggered); },
                        () => { this.coder.returnStatement(); },
                        null,
                      );

                      this.coder.statement(() => {
                        this.coder.assignAnonymous(
                          triggered, this.coder.literal(true),
                        );
                      });
                    });
                  },
                ));
              });
            });
          },
        });
      },
    ]);
  }
}
