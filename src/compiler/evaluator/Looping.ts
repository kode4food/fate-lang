"use strict";

import * as Syntax from '../syntax';
import { NodeEvaluator } from './Evaluator';

type IdMapping = { id: string, anon: string };

export class ReduceEvaluator extends NodeEvaluator {
  public static tags = ['reduce'];
  public node: Syntax.ReduceExpression;

  public evaluate() {
    let statements = this.node.template('statements', [
      this.node.template(
        'assignment', this.node.assignment.id, this.node.select.value
      )
    ]);
    let forNode = this.node.template('for',
      this.node.ranges,
      statements,
      this.node.template('statements', []),
      [this.node.assignment]
    );

    let single = Syntax.hasAnnotation(this.node, 'function/single_expression');
    let bodyGenerator = single ? this.coder.scope : this.coder.iife;
    bodyGenerator(() => {
      new ForEvaluator(this, forNode).evaluate();
    });
  }
}

abstract class LoopEvaluator extends NodeEvaluator {
  protected createLoop(ranges: Syntax.Ranges, createBody: Function,
                       successVar?: string) {
    let self = this;
    processRange(0);

    function processRange(i: number) {
      if ( i === ranges.length ) {
        if ( successVar ) {
          self.coder.statement(() => {
            self.coder.assignAnonymous(successVar, self.coder.literal(true));
          });
        }
        createBody();
        return;
      }

      let range = ranges[i];
      let valueId = range.valueId.value;
      let nameId = range.nameId ? range.nameId.value : null;
      let guardFunc: Function;

      if ( range.guard ) {
        // we have a guard
        guardFunc = () => {
          self.coder.ifStatement(
            self.defer(range.guard),
            null,
            () => { self.coder.loopContinue(); }
          );
        };
      }

      if ( i === 0 ) {
        genLoopExpression();
      }
      else {
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
          }
        });
      }
    }
  }
}

export class ForEvaluator extends LoopEvaluator {
  public static tags = ['for'];
  public node: Syntax.ForStatement;

  public evaluate() {
    let self = this;

    let generateLoop: Function, generateBody: Function;
    let idMappings: IdMapping[];
    let reduceAssignments = self.node.reduceAssignments;

    if ( reduceAssignments ) {
      generateLoop = generateReduceLoop;
      generateBody = generateReduceBody;
    }
    else {
      generateLoop = generateForLoop;
      generateBody = generateForBody;
    }

    generateStatements();
    if ( reduceAssignments ) {
      generateReduceResult();
    }

    function generateStatements() {
      let elseStatements = self.node.elseStatements;
      if ( elseStatements.isEmpty() ) {
        return generateLoop();
      }

      let successVar = self.coder.createAnonymous();
      self.coder.assignment(successVar, self.coder.literal(false));
      generateLoop(successVar);
      self.coder.ifStatement(
        () => { self.coder.retrieveAnonymous(successVar); },
        null,
        () => { self.dispatch(elseStatements); }
      );
    }

    function generateReduceResult() {
      self.coder.statement(() => {
        self.coder.assignResult(() => {
          let ids = self.node.getReduceIdentifiers();
          if ( ids.length === 1 ) {
            self.coder.getter(ids[0].value);
            return;
          }
          self.coder.array(ids.map(
            id => () => { self.coder.getter(id.value); }
          ));
        });
      });
    }

    function generateReduceInitializers() {
      reduceAssignments.forEach(reduceAssignment => {
        self.dispatch(reduceAssignment);
      });
    }

    function createAnonymousCounters() {
      idMappings = self.node.getReduceIdentifiers().map(id => {
        return {
          id: id.value,
          anon: self.coder.createAnonymous()
        };
      });
    }

    function generateResultAssignments() {
      idMappings.forEach(mapping => {
        self.coder.assignment(mapping.id, () => {
          self.coder.retrieveAnonymous(mapping.anon);
        });
      });
    }

    function generateAnonymousAssignments() {
      idMappings.forEach(mapping => {
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
  public static tags = ['forExpr'];
  public node: Syntax.ForExpression;

  public evaluate() {
    let self = this;
    let hasName = this.node.select.name;
    let bodyGenerator = hasName ? namedBody : counterBody;
    this.coder.generator(bodyGenerator);

    function counterBody() {
      let counter = self.coder.createCounter();
      self.createLoop(self.node.ranges, () => {
        self.coder.emitStatement(() => {
          self.coder.array([
            self.defer(self.node.select.value),
            () => { counter.next(); }
          ]);
        });
      });
    }

    function namedBody() {
      self.createLoop(self.node.ranges, () => {
        self.coder.emitStatement(() => {
          self.coder.array([
            self.defer(self.node.select.value),
            self.defer(self.node.select.name)
          ]);
        });
      });
    }
  }
}

class ListComprehensionEvaluator extends NodeEvaluator {
  public node: Syntax.ListComprehension;
  public materializer: string;

  public evaluate() {
    let materialize = this.coder.runtimeImport(this.materializer);
    this.coder.call(materialize, [
      this.defer(this.node.forExpression)
    ]);
  }
}
export class ArrayComprehensionEvaluator extends ListComprehensionEvaluator {
  public static tags = ['arrayComp'];
  public materializer = 'materializeArray';
}

export class ObjectComprehensionEvaluator extends ListComprehensionEvaluator {
  public static tags = ['objectComp'];
  public materializer = 'materializeObject';
}
