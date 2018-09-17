/** @flow */

import * as Target from "../target";
import * as Syntax from "../syntax";

import { NodeEvaluator } from "./evaluator";
import { Cardinality } from "../syntax";

export class CallEvaluator extends NodeEvaluator {
  static tags = ["call"];
  node: Syntax.CallOperator;

  evaluate(...args: any[]) {
    this.coder.call(
      this.defer(this.node.left),
      this.node.right.map(argNode => this.defer(argNode))
    );
  }
}

export class BindEvaluator extends NodeEvaluator {
  static tags = ["bind"];
  node: Syntax.BindOperator;

  evaluate(...args: any[]) {
    this.coder.call(this.coder.runtimeImport("bindFunction"), [
      this.defer(this.node.left),
      () => {
        const elems: Target.ObjectAssignmentItems = [];
        this.node.right.forEach((argNode, index) => {
          if (argNode instanceof Syntax.Wildcard) {
            return;
          }
          elems.push([this.coder.literal(index), this.defer(argNode), false]);
        });
        this.coder.object(elems);
      }
    ]);
  }
}

export class ReturnEvaluator extends NodeEvaluator {
  static tags = ["return"];
  node: Syntax.ReturnStatement;

  evaluate(...args: any[]) {
    this.coder.returnStatement(this.defer(this.node.result));
  }
}

class FuncOrLambdaEvaluator extends NodeEvaluator {
  node: Syntax.FunctionDeclaration | Syntax.LambdaExpression;

  getFuncOrLambdaInternalId() {
    const hasSelf = Syntax.hasAnnotation(this.node, "function/self");
    const hasGuard = this.node.signature.guard;
    return hasSelf || hasGuard ? this.coder.selfName : undefined;
  }

  getFixedParamNames(params: Syntax.Parameters) {
    let isFixed = true;
    return params
      .filter(param => {
        isFixed = isFixed && param.cardinality === Cardinality.Required;
        return isFixed;
      })
      .map(param => param.id.value);
  }

  generateParamProcessor(params: Syntax.Parameters) {
    const fixedCount = this.getFixedParamNames(params).length;
    if (fixedCount === params.length) {
      return;
    }

    const nonFixed = params.slice(fixedCount);
    nonFixed.forEach((param, idx) => {
      if (param.cardinality !== Cardinality.ZeroToMany) {
        throw new Error("Stupid Coder: Unexpected cardinality");
      }

      this.coder.assignment(param.id.value, () => {
        this.coder.args(fixedCount);
      });
    });
  }
}

export class FunctionEvaluator extends FuncOrLambdaEvaluator {
  static tags = ["function"];
  node: Syntax.FunctionDeclaration;

  evaluate(...args: any[]) {
    const signature = this.node.signature;
    const create = signature.guard ? this.createGuarded : this.createUnguarded;
    create.call(this);
  }

  createUnguarded() {
    const signature = this.node.signature;
    const functionName = signature.id;
    const params = signature.params;
    const paramNames = this.getFixedParamNames(params);

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
    const signature = this.node.signature;
    const functionName = signature.id;
    const params = signature.params;
    const paramNames = this.getFixedParamNames(params);
    const ensured = this.generateEnsured();

    this.coder.funcDeclaration(functionName.value, {
      internalId: this.getFuncOrLambdaInternalId(),
      contextArgs: paramNames,
      body: () => {
        this.generateParamProcessor(params);
        this.coder.ifStatement(
          this.defer(signature.guard),
          null, // this is an 'else' case
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
    const signature = this.node.signature;
    const functionName = signature.id;

    if (!Syntax.hasAnnotation(this.node, "function/shadow")) {
      return this.coder.runtimeImport("functionNotExhaustive");
    }

    const ensure = this.coder.runtimeImport("ensureFunction");
    const ensuredId = this.coder.createAnonymous();

    this.coder.statement(() => {
      this.coder.assignAnonymous(ensuredId, () => {
        this.coder.call(ensure, [
          () => {
            this.coder.getter(functionName.value);
          }
        ]);
      });
    });

    return () => {
      this.coder.retrieveAnonymous(ensuredId);
    };
  }
}

export class LambdaEvaluator extends FuncOrLambdaEvaluator {
  static tags = ["lambda"];
  node: Syntax.LambdaExpression;

  evaluate(...args: any[]) {
    const signature = this.node.signature;
    const params = signature.params;
    const paramNames = this.getFixedParamNames(params);

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

export class ComposeEvaluator extends NodeEvaluator {
  static tags = ["compose", "composeOr", "composeAnd"];
  node: Syntax.ComposeExpression;

  evaluate(...args: any[]) {
    this.coder.call(this.coder.runtimeImport(this.node.tag), [
      () => {
        this.coder.array(
          this.node.expressions.map(expression => this.defer(expression))
        );
      }
    ]);
  }
}
