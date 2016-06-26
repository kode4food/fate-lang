"use strict";

import * as Target from '../target';
import * as Syntax from '../syntax';

import { NodeEvaluator } from './Evaluator';

interface StringMap {
  [index: string]: string;
}

export class CallEvaluator extends NodeEvaluator {
  public static tags = ['call'];
  public node: Syntax.CallOperator;

  public evaluate() {
    this.coder.call(
      this.defer(this.node.left),
      this.node.right.map(argNode => this.defer(argNode))
    );
  }
}

export class BindEvaluator extends NodeEvaluator {
  public static tags = ['bind'];
  public node: Syntax.BindOperator;

  public evaluate() {
    this.coder.call(this.coder.runtimeImport('bindFunction'), [
      this.defer(this.node.left),
      () => {
        let elems: Target.ObjectAssignmentItems = [];
        this.node.right.forEach((argNode, index) => {
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
  public node: Syntax.ReturnStatement;

  public evaluate() {
    this.coder.returnStatement(this.defer(this.node.result));
  }
}

abstract class FuncOrLambdaEvaluator extends NodeEvaluator {
  public node: Syntax.FunctionDeclaration|Syntax.LambdaExpression;

  protected getFuncOrLambdaInternalId() {
    let hasSelf = Syntax.hasAnnotation(this.node, 'function/self');
    let hasGuard = this.node.signature.guard;
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
  public node: Syntax.FunctionDeclaration;

  public evaluate() {
    let signature = this.node.signature;
    let create = signature.guard ? this.createGuarded : this.createUnguarded;
    create.call(this);
  }

  private createUnguarded() {
    let signature = this.node.signature;
    let functionName = signature.id;
    let params = signature.params;
    let paramNames = this.getFixedParamNames(params);

    this.coder.funcDeclaration(functionName.value, {
      internalId: this.getFuncOrLambdaInternalId(),
      contextArgs: paramNames,
      body: () => {
        this.generateParamProcessor(params);
        this.getRootEvaluator().evaluate(this.node.statements);
      }
    });
  }

  private createGuarded() {
    let signature = this.node.signature;
    let functionName = signature.id;
    let params = signature.params;
    let paramNames = this.getFixedParamNames(params);
    let ensured = this.generateEnsured();

    this.coder.funcDeclaration(functionName.value, {
      internalId: this.getFuncOrLambdaInternalId(),
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
        this.getRootEvaluator().evaluate(this.node.statements);
      }
    });
  }

  private generateEnsured(): Target.BodyEntry {
    let signature = this.node.signature;
    let functionName = signature.id;

    if ( !Syntax.hasAnnotation(this.node, 'function/shadow') ) {
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
  public node: Syntax.LambdaExpression;

  public evaluate() {
    let signature = this.node.signature;
    let params = signature.params;
    let paramNames = this.getFixedParamNames(params);

    this.coder.parens(() => {
      this.coder.func({
        internalId: this.getFuncOrLambdaInternalId(),
        contextArgs: paramNames,
        body: () => {
          this.generateParamProcessor(params);
          this.getRootEvaluator().evaluate(this.node.statements);
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
  public node: Syntax.ComposeExpression;

  public evaluate() {
    this.coder.call(
      this.coder.runtimeImport(composeImportMap[this.node.tag]),
      [() => {
        this.coder.array(
          this.node.expressions.map(expression => this.defer(expression))
        );
      }]
    );
  }
}
