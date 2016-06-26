"use strict";

import * as Target from '../target';
import * as Syntax from '../syntax';

import { BodyEntry } from '../target';
import { NodeEvaluator } from './Evaluator';
import { StatementsEvaluator } from './BasicEvaluator';

interface StringMap {
  [index: string]: string;
}

export class CallEvaluator extends NodeEvaluator {
  public static tags = ['call'];

  public evaluate(node: Syntax.CallOperator) {
    this.coder.call(
      this.defer(node.left),
      node.right.map(argNode => this.defer(argNode))
    );
  }
}

export class BindEvaluator extends NodeEvaluator {
  public static tags = ['bind'];

  public evaluate(node: Syntax.BindOperator) {
    this.coder.call(this.coder.runtimeImport('bindFunction'), [
      this.defer(node.left),
      () => {
        let elems: Target.ObjectAssignmentItems = [];
        node.right.forEach((argNode, index) => {
          if ( argNode instanceof Syntax.Wildcard ) {
            return;
          }
          elems.push([
            this.coder.literal(index), <Function>this.defer(argNode), false
          ]);
        });
        this.coder.object(elems);
      }
    ]);
  }
}

export class ReturnEvaluator extends NodeEvaluator {
  public static tags = ['return'];

  public evaluate(node: Syntax.ReturnStatement) {
    this.coder.returnStatement(this.defer(node.result));
  }
}

abstract class FuncOrLambdaEvaluator extends NodeEvaluator {
  protected getFuncOrLambdaInternalId(node: Syntax.FunctionOrLambda) {
    let hasSelf = Syntax.hasAnnotation(node, 'function/self');
    let hasGuard = node.signature.guard;
    return hasSelf || hasGuard  ? this.coder.selfName : undefined;
  }

  protected getFixedParamNames(params: Syntax.Parameters) {
    let isFixed = true;
    return params.filter(param => {
      isFixed = isFixed && param.cardinality === Syntax.Cardinality.Required;
      return isFixed;
    }).map(param => param.id.value);
  }

  protected generateParamProcessor(params: Syntax.Parameters) {
    let fixedCount = this.getFixedParamNames(params).length;
    if ( fixedCount === params.length ) {
      return;
    }

    let nonFixed = params.slice(fixedCount);
    nonFixed.forEach((param, idx) => {
      /* istanbul ignore next: Required and ZeroToMany are all we support */
      if ( param.cardinality !== Syntax.Cardinality.ZeroToMany ) {
        throw new Error("Stupid Coder: Unexpected cardinality");
      }

      this.coder.assignment(
        param.id.value,
        () => { this.coder.args(fixedCount); }
      );
    });
  }
}

export class FunctionEvaluator extends FuncOrLambdaEvaluator {
  public static tags = ['function'];

  public evaluate(node: Syntax.FunctionDeclaration) {
    let signature = node.signature;
    let create = signature.guard ? this.createGuarded : this.createUnguarded;
    create.call(this, node);
  }

  private createUnguarded(node: Syntax.FunctionDeclaration) {
    let signature = node.signature;
    let functionName = signature.id;
    let params = signature.params;
    let paramNames = this.getFixedParamNames(params);

    this.coder.funcDeclaration(functionName.value, {
      internalId: this.getFuncOrLambdaInternalId(node),
      contextArgs: paramNames,
      body: () => {
        this.generateParamProcessor(params);
        let evaluator = new StatementsEvaluator(this);
        evaluator.evaluate(node.statements);
      }
    });
  }

  private createGuarded(node: Syntax.FunctionDeclaration) {
    let signature = node.signature;
    let functionName = signature.id;
    let params = signature.params;
    let paramNames = this.getFixedParamNames(params);
    let ensured = this.generateEnsured(node);

    this.coder.funcDeclaration(functionName.value, {
      internalId: this.getFuncOrLambdaInternalId(node),
      contextArgs: paramNames,
      body: () => {
        this.generateParamProcessor(params);
        this.coder.ifStatement(
          this.defer(signature.guard),
          null,  // this is an 'else' case
          () => {
            this.coder.returnStatement(() => {
              this.coder.call(ensured);
            });
          }
        );
        let evaluator = new StatementsEvaluator(this);
        evaluator.evaluate(node.statements);
      }
    });
  }

  private generateEnsured(node: Syntax.FunctionDeclaration): BodyEntry {
    let signature = node.signature;
    let functionName = signature.id;

    if ( !Syntax.hasAnnotation(node, 'function/shadow') ) {
      return this.coder.runtimeImport('functionNotExhaustive');
    }

    let ensure = this.coder.runtimeImport('ensureFunction');
    let ensuredId = this.coder.createAnonymous();

    this.coder.statement(() => {
      this.coder.assignAnonymous(ensuredId, () => {
        this.coder.call(ensure, [() => {
          this.coder.getter(functionName.value);
        }]);
      });
    });

    return () => {
      this.coder.retrieveAnonymous(ensuredId);
    };
  }
}

export class LambdaEvaluator extends FuncOrLambdaEvaluator {
  public static tags = ['lambda'];

  public evaluate(node: Syntax.LambdaExpression) {
    let signature = node.signature;
    let params = signature.params;
    let paramNames = this.getFixedParamNames(params);

    this.coder.parens(() => {
      this.coder.func({
        internalId: this.getFuncOrLambdaInternalId(node),
        contextArgs: paramNames,
        body: () => {
          this.generateParamProcessor(params);
          let evaluator = new StatementsEvaluator(this);
          evaluator.evaluate(node.statements);
        }
      });
    });
  }
}

const composeImportMap: StringMap = {
  'compose': 'compose',
  'composeOr': 'composeOr',
  'composeAnd': 'composeAnd'
};

export class ComposeEvaluator extends NodeEvaluator {
  public static tags = Object.keys(composeImportMap);

  public evaluate(node: Syntax.ComposeExpression) {
    this.coder.call(
      this.coder.runtimeImport(composeImportMap[node.tag]),
      [() => {
        this.coder.array(
          node.expressions.map(expression => this.defer(expression))
        );
      }]
    );
  }
}
