"use strict";

import * as Syntax from '../syntax';
import { NodeEvaluator } from './Evaluator';
import { AssignmentEvaluator } from './AssignmentEvaluator';
import { StatementsEvaluator } from './BasicEvaluator';

export class AwaitEvaluator extends NodeEvaluator {
  public static tags = ['await'];

  public evaluate(node: Syntax.AwaitOperator) {
    this.coder.waitFor(node.resolver, this.defer(node.left));
  }
}

export class DoEvaluator extends NodeEvaluator {
  public static tags = ['do'];

  public evaluate(node: Syntax.DoExpression, caseGuard?: Function) {
    this.coder.call(this.coder.runtimeImport('createDoBlock'), [
      () => {
        this.coder.func({
          generator: true,
          body: () => {
            if ( node.whenClause instanceof Syntax.LetStatement ) {
              let whenClause = <Syntax.LetStatement>node.whenClause;
              let groups = this.getAssignmentGroups(whenClause.assignments);
              groups.forEach(group => this.generateAssignment(group));
            }
            else if ( node.whenClause ) {
              this.generateExpression(node.whenClause);
            }

            if ( caseGuard ) {
              caseGuard();
            }

            let evaluator = new StatementsEvaluator(this);
            evaluator.evaluate(node.statements);
          }
        });
      }
    ]);
  }

  private generateExpression(expression: Syntax.Expression) {
    this.coder.statement(() => {
      this.coder.assignResult(() => {
        this.coder.waitFor(Syntax.Resolver.Value, () => {
          this.getRootEvaluator().evaluate(expression);
        });
      });
    });
  }

  private getAssignmentGroups(assignments: Syntax.Assignments) {
    let groups: Syntax.Assignments[] = [];

    assignments.forEach(assignment => {
      let groupNum = Syntax.getAnnotation(assignment, 'when/group') || 0;
      let group = groups[groupNum] || (groups[groupNum] = []);
      group.push(assignment);
    });

    return groups;
  }

  private generateAssignment(group: Syntax.Assignments) {
    let anon = this.coder.createAnonymous();
    this.coder.statement(() => {
      this.coder.assignAnonymous(anon, () => {
        this.coder.waitFor(Syntax.Resolver.All, () => {
          this.coder.array(
            group.map(assignment => this.defer(assignment.value))
          );
        });
      });
    });

    group.forEach((assignment, index) => {
      let evaluator = new AssignmentEvaluator(this);
      evaluator.evaluate(assignment, () => {
        return () => {
          this.coder.member(
            () => { this.coder.retrieveAnonymous(anon); },
            this.coder.literal(index)
          );
        };
      });
    });
  }
}

export class CaseEvaluator extends NodeEvaluator {
  public static tags = ['case'];

  public evaluate(node: Syntax.CaseExpression) {
    this.coder.call(this.coder.runtimeImport('createDoBlock'), [
      () => {
        this.coder.func({
          generator: true,
          body: () => {
            let triggered = this.coder.createAnonymous();

            this.coder.returnStatement(() => {
              this.coder.waitFor(Syntax.Resolver.Any, () => {
                this.coder.array(node.cases.map(
                  doCase => () => {
                    let evaluator = new DoEvaluator(this);
                    evaluator.evaluate(doCase, () => {
                      this.coder.ifStatement(
                        () => { this.coder.retrieveAnonymous(triggered); },
                        () => { this.coder.returnStatement(); },
                        null
                      );

                      this.coder.statement(() => {
                        this.coder.assignAnonymous(
                          triggered, this.coder.literal(true)
                        );
                      });
                    });
                  }
                ));
              });
            });
          }
        });
      }
    ]);
  }
}
