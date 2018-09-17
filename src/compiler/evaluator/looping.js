/** @flow */

import * as Syntax from '../syntax';
import { NodeEvaluator } from './evaluator';
import type { Evaluator } from './evaluator';

type IdMapping = { id: string, anon: string };

export class ReduceEvaluator extends NodeEvaluator {
  static tags = ['reduce'];
  node: Syntax.ReduceExpression;

  constructor(parent: Evaluator, node: Syntax.ReduceExpression) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    const statements = this.node.template('statements', [
      this.node.template(
        'assignment',
        this.node.assignment.id,
        this.node.select.value,
      ),
    ]);
    const forNode = this.node.template(
      'for',
      this.node.ranges,
      statements,
      this.node.template('statements', []),
      [this.node.assignment],
    );

    const single = Syntax.hasAnnotation(this.node, 'function/single_expression');
    const bodyGenerator = single ? this.coder.scope : this.coder.iife;
    bodyGenerator(() => {
      new ForEvaluator(this, forNode).evaluate();
    });
  }
}

class LoopEvaluator extends NodeEvaluator {
  createLoop(ranges: Syntax.Ranges, createBody: Function, successVar?: string) {
    const self = this;
    processRange(0);

    function processRange(i: number) {
      if (i === ranges.length) {
        if (successVar) {
          self.coder.statement(() => {
            self.coder.assignAnonymous(successVar, self.coder.literal(true));
          });
        }
        createBody();
        return;
      }

      const range = ranges[i];
      const valueId = range.valueId.value;
      const nameId = range.nameId ? range.nameId.value : null;
      let guardFunc: Function;

      if (range.guard) {
        // we have a guard
        guardFunc = () => {
          self.coder.ifStatement(self.defer(range.guard), null, () => {
            self.coder.loopContinue();
          });
        };
      }

      if (i === 0) {
        genLoopExpression();
      } else {
        self.coder.statement(genLoopExpression);
      }

      function genLoopExpression() {
        self.coder.loopExpression({
          value: valueId,
          name: nameId,
          collection: self.defer(range.collection),
          guard: guardFunc,
          body: () => {
            processRange(i + 1);
          },
        });
      }
    }
  }
}

export class ForEvaluator extends LoopEvaluator {
  static tags = ['for'];
  node: Syntax.ForStatement;

  constructor(parent: Evaluator, node: Syntax.ForStatement) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    const self = this;

    let generateLoop: Function; let
      generateBody: Function;
    let idMappings: IdMapping[];
    const { reduceAssignments } = self.node;

    if (reduceAssignments) {
      generateLoop = generateReduceLoop;
      generateBody = generateReduceBody;
    } else {
      generateLoop = generateForLoop;
      generateBody = generateForBody;
    }

    generateStatements();
    if (reduceAssignments) {
      generateReduceResult();
    }

    function generateStatements() {
      const { elseStatements } = self.node;
      if (elseStatements.isEmpty()) {
        generateLoop();
        return;
      }

      const successVar = self.coder.createAnonymous();
      self.coder.assignment(successVar, self.coder.literal(false));
      generateLoop(successVar);
      self.coder.ifStatement(
        () => { self.coder.retrieveAnonymous(successVar); },
        null,
        () => { self.dispatch(elseStatements); },
      );
    }

    function generateReduceResult() {
      self.coder.statement(() => {
        self.coder.assignResult(() => {
          const ids = self.node.getReduceIdentifiers();
          if (ids.length === 1) {
            self.coder.getter(ids[0].value);
            return;
          }
          self.coder.array(
            ids.map(id => () => {
              self.coder.getter(id.value);
            }),
          );
        });
      });
    }

    function generateReduceInitializers() {
      reduceAssignments.forEach((reduceAssignment) => {
        self.dispatch(reduceAssignment);
      });
    }

    function createAnonymousCounters() {
      idMappings = self.node.getReduceIdentifiers().map(id => ({
        id: id.value,
        anon: self.coder.createAnonymous(),
      }));
    }

    function generateResultAssignments() {
      idMappings.forEach((mapping) => {
        self.coder.assignment(mapping.id, () => {
          self.coder.retrieveAnonymous(mapping.anon);
        });
      });
    }

    function generateAnonymousAssignments() {
      idMappings.forEach((mapping) => {
        self.coder.statement(() => {
          self.coder.assignAnonymous(mapping.anon, () => {
            self.coder.getter(mapping.id);
          });
        });
      });
    }

    function generateReduceLoop(successVar?: string) {
      generateReduceInitializers();
      createAnonymousCounters();
      generateAnonymousAssignments();
      generateForLoop(successVar);
      generateResultAssignments();
    }

    function generateForLoop(successVar?: string) {
      self.coder.statement(() => {
        self.createLoop(self.node.ranges, generateBody, successVar);
      });
    }

    function generateReduceBody() {
      generateResultAssignments();
      generateForBody();
      generateAnonymousAssignments();
    }

    function generateForBody() {
      self.dispatch(self.node.loopStatements);
    }
  }
}

export class ForExpressionEvaluator extends LoopEvaluator {
  static tags = ['forExpr'];
  node: Syntax.ForExpression;

  constructor(parent: Evaluator, node: Syntax.ForExpression) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    const self = this;
    const hasName = this.node.select.name;
    const bodyGenerator = hasName ? namedBody : counterBody;
    this.coder.generator(bodyGenerator);

    function counterBody() {
      self.coder.createCounter('idx');
      self.createLoop(self.node.ranges, () => {
        self.coder.emitStatement(() => {
          self.coder.array([
            self.defer(self.node.select.value),
            () => {
              self.coder.incrementCounter('idx');
            },
          ]);
        });
      });
    }

    function namedBody() {
      self.createLoop(self.node.ranges, () => {
        self.coder.emitStatement(() => {
          self.coder.array([
            self.defer(self.node.select.value),
            self.defer(self.node.select.name),
          ]);
        });
      });
    }
  }
}

class ListComprehensionEvaluator extends NodeEvaluator {
  node: Syntax.ListComprehension;
  materializer: string;

  constructor(parent: Evaluator, node: Syntax.ListComprehension) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    const materialize = this.coder.runtimeImport(this.materializer);
    this.coder.call(materialize, [this.defer(this.node.forExpression)]);
  }
}

export class ArrayComprehensionEvaluator extends ListComprehensionEvaluator {
  static tags = ['arrayComp'];
  materializer = 'materializeArray';
}

export class ObjectComprehensionEvaluator extends ListComprehensionEvaluator {
  static tags = ['objectComp'];
  materializer = 'materializeObject';
}

export class GenerateEvaluator extends NodeEvaluator {
  static tags = ['generate'];
  node: Syntax.GenerateExpression;

  constructor(parent: Evaluator, node: Syntax.GenerateExpression) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    this.coder.generator(() => {
      this.coder.createCounter('idx');
      this.dispatch(this.node.statements);
    });
  }
}

export class EmitEvaluator extends NodeEvaluator {
  static tags = ['emit'];
  node: Syntax.EmitStatement;

  constructor(parent: Evaluator, node: Syntax.EmitStatement) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    this.coder.emitStatement(() => {
      this.coder.array([
        this.defer(this.node.value),
        () => {
          this.coder.incrementCounter('idx');
        },
      ]);
    });
  }
}
