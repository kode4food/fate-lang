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
        'assignment', this.node.assignment.id, this.node.select
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

export class ListCompEvaluator extends LoopEvaluator {
  public static tags = ['arrayComp', 'objectComp'];
  public node: Syntax.ListComprehension;

  public evaluate() {
    let self = this;
    let single = Syntax.hasAnnotation(self.node, 'function/single_expression');
    let bodyGenerator = single ? this.coder.scope : this.coder.iife;
    bodyGenerator(functionWrapperBody);

    function functionWrapperBody() {
      let isObject = self.node instanceof Syntax.ObjectComprehension;
      let genContainer = isObject ? self.coder.object : self.coder.array;
      let createBody = isObject ? createNameValueBody : createValueBody;
      let result = self.coder.createAnonymous();

      self.coder.statement(() => {
        self.coder.assignAnonymous(result, () => {
          (<Function>genContainer)([]);
        });
      });

      self.createLoop(self.node.ranges, createBody);
      self.coder.statement(() => {
        self.coder.assignResult(() => {
          self.coder.retrieveAnonymous(result);
        });
      });

      function createValueBody() {
        let arrayCompNode = <Syntax.ArrayComprehension>self.node;
        self.coder.statement(() => {
          self.coder.arrayAppend(result, self.defer(arrayCompNode.value));
        });
      }

      function createNameValueBody() {
        let objectCompNode = <Syntax.ObjectComprehension>self.node;
        let assign = objectCompNode.assignment;
        self.coder.statement(() => {
          self.coder.objectAssign(
            result, self.defer(assign.id), self.defer(assign.value)
          );
        });
      }
    }
  }
}
