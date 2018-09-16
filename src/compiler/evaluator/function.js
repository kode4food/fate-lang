/** @flow */

import * as Target from '../target';
import * as Syntax from '../syntax';

import { NodeEvaluator } from './evaluator';
import {Cardinality} from "../syntax";

export class CallEvaluator extends NodeEvaluator {
  node: Syntax.CallOperator;

  evaluate() {
    this.coder.call(
      this.defer(this.node.left),
      this.node.right.map(argNode => this.defer(argNode))
    );
  }
}
CallEvaluator.tags = ['call'];

export class BindEvaluator extends NodeEvaluator {
  node: Syntax.BindOperator;

  evaluate() {
    this.coder.call(this.coder.runtimeImport('bindFunction'), [
      this.defer(this.node.left),
      () => {
        let elems: Target.ObjectAssignmentItems = [];
        this.node.right.forEach((argNode, index) => {
          if ( argNode instanceof Syntax.Wildcard ) {
            return;
          }
          elems.push([
            this.coder.literal(index), this.defer(argNode), false
          ]);
        });
        this.coder.object(elems);
      }
    ]);
  }
}
BindEvaluator.tags = ['bind'];

export class ReturnEvaluator extends NodeEvaluator {
  node: Syntax.ReturnStatement;

  evaluate() {
    this.coder.returnStatement(this.defer(this.node.result));
  }
}
ReturnEvaluator.tags = ['return'];

class FuncOrLambdaEvaluator extends NodeEvaluator {
  node: Syntax.FunctionDeclaration|Syntax.LambdaExpression;

  getFuncOrLambdaInternalId() {
    let hasSelf = Syntax.hasAnnotation(this.node, 'function/self');
    let hasGuard = this.node.signature.guard;
    return hasSelf || hasGuard  ? this.coder.selfName : undefined;
  }

  getFixedParamNames(params: Syntax.Parameters) {
    let isFixed = true;
    return params.filter(param => {
      isFixed = isFixed && param.cardinality === Cardinality.Required;
      return isFixed;
    }).map(param => param.id.value);
  }

  generateParamProcessor(params: Syntax.Parameters) {
    let fixedCount = this.getFixedParamNames(params).length;
    if ( fixedCount === params.length ) {
      return;
    }

    let nonFixed = params.slice(fixedCount);
    nonFixed.forEach((param, idx) => {
      if ( param.cardinality !== Cardinality.ZeroToMany ) {
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
  node: Syntax.FunctionDeclaration;

  evaluate() {
    let signature = this.node.signature;
    let create = signature.guard ? this.createGuarded : this.createUnguarded;
    create.call(this);
  }

  createUnguarded() {
    let signature = this.node.signature;
    let functionName = signature.id;
    let params = signature.params;
    let paramNames = this.getFixedParamNames(params);

    this.coder.funcDeclaration(functionName.value, {
      internalId: this.getFuncOrLambdaInternalId(),
      contextArgs: paramNames,
      body: () => {
        this.generateParamProcessor(params);
        this.dispatch(this.node.statements);
      }
    });
  }

  createGuarded() {
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
        this.dispatch(this.node.statements);
      }
    });
  }

  generateEnsured(): Target.BodyEntry {
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
FunctionEvaluator.tags = ['function'];

export class LambdaEvaluator extends FuncOrLambdaEvaluator {
  node: Syntax.LambdaExpression;

  evaluate() {
    let signature = this.node.signature;
    let params = signature.params;
    let paramNames = this.getFixedParamNames(params);

    this.coder.parens(() => {
      this.coder.func({
        internalId: this.getFuncOrLambdaInternalId(),
        contextArgs: paramNames,
        body: () => {
          this.generateParamProcessor(params);
          this.dispatch(this.node.statements);
        }
      });
    });
  }
}
LambdaEvaluator.tags = ['lambda'];

export class ComposeEvaluator extends NodeEvaluator {
  node: Syntax.ComposeExpression;

  evaluate() {
    this.coder.call(
      this.coder.runtimeImport(this.node.tag),
      [() => {
        this.coder.array(
          this.node.expressions.map(expression => this.defer(expression))
        );
      }]
    );
  }
}
ComposeEvaluator.tags = ['compose', 'composeOr', 'composeAnd'];
