"use strict";

import * as Syntax from '../syntax';
import { Evaluator } from './Evaluator';
import { AssignmentEvaluator } from './AssignmentEvaluator';
import { StatementsEvaluator } from './BasicEvaluator';

export class AwaitEvaluator extends Evaluator {
  public static tags = ['await'];

  public evaluate(node: Syntax.AwaitOperator) {
    this.coder.waitFor(node.resolver, this.defer(node.left));
  }
}

export class DoEvaluator extends Evaluator {
  public static tags = ['do'];

  public evaluate(node: Syntax.DoExpression, caseGuard?: Function) {
    let self = this;

    self.coder.call(self.coder.runtimeImport('createDoBlock'), [
      () => {
        self.coder.func({
          generator: true,
          body: doBody
        });
      }
    ]);

    function doBody() {
      if ( node.whenClause instanceof Syntax.LetStatement ) {
        let whenClause = <Syntax.LetStatement>node.whenClause;
        let groups = getAssignmentGroups(whenClause.assignments);
        groups.forEach(generateAssignment);
      }
      else if ( node.whenClause ) {
        generateExpression(node.whenClause);
      }

      if ( caseGuard ) {
        caseGuard();
      }

      let evaluator = new StatementsEvaluator(self);
      evaluator.evaluate(node.statements);
    }

    function generateExpression(expression: Syntax.Expression) {
      self.coder.statement(() => {
        self.coder.assignResult(() => {
          self.coder.waitFor(Syntax.Resolver.Value, () => {
            self.getRootEvaluator().evaluate(expression);
          });
        });
      });
    }

    function generateAssignment(group: Syntax.Assignments) {
      let anon = self.coder.createAnonymous();
      self.coder.statement(() => {
        self.coder.assignAnonymous(anon, () => {
          self.coder.waitFor(Syntax.Resolver.All, () => {
            self.coder.array(
              group.map(assignment => self.defer(assignment.value))
            );
          });
        });
      });

      group.forEach((assignment, index) => {
        let evaluator = new AssignmentEvaluator(self);
        evaluator.evaluate(assignment, () => {
          return () => {
            self.coder.member(
              () => { self.coder.retrieveAnonymous(anon); },
              self.coder.literal(index)
            );
          };
        });
      });
    }

    function getAssignmentGroups(assignments: Syntax.Assignments) {
      let groups: Syntax.Assignments[] = [];

      assignments.forEach(assignment => {
        let groupNum = Syntax.getAnnotation(assignment, 'when/group') || 0;
        let group = groups[groupNum] || (groups[groupNum] = []);
        group.push(assignment);
      });

      return groups;
    }
  }
}

export class CaseEvaluator extends Evaluator {
  public static tags = ['case'];

  public evaluate(node: Syntax.CaseExpression) {
    let self = this;

    self.coder.call(self.coder.runtimeImport('createDoBlock'), [
      () => {
        self.coder.func({
          generator: true,
          body: doBody
        });
      }
    ]);

    function doBody() {
      let triggered = self.coder.createAnonymous();

      self.coder.returnStatement(() => {
        self.coder.waitFor(Syntax.Resolver.Any, () => {
          self.coder.array(node.cases.map(
            doCase => () => {
              let evaluator = new DoEvaluator(self);
              evaluator.evaluate(doCase, () => {
                self.coder.ifStatement(
                  () => { self.coder.retrieveAnonymous(triggered); },
                  () => { self.coder.returnStatement(); },
                  null
                );

                self.coder.statement(() => {
                  self.coder.assignAnonymous(
                    triggered, self.coder.literal(true)
                  );
                });
              });
            }
          ));
        });
      });
    }
  }
}
