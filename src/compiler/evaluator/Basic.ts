"use strict";

import * as Target from '../target';
import * as Syntax from '../syntax';
import { NodeEvaluator } from './Evaluator';

export class BinaryEvaluator extends NodeEvaluator {
  public static tags = [
    'eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'add', 'sub', 'mul', 'div', 'mod'
  ];
  public node: Syntax.BinaryOperator;

  public evaluate() {
    this.coder.binaryOperator(
      this.node.tag,
      this.defer(this.node.left),
      this.defer(this.node.right)
    );
  }
}

export class StatementsEvaluator extends NodeEvaluator {
  public static tags = ['statements'];
  public node: Syntax.Statements;

  public evaluate() {
    this.node.statements.forEach(statement => {
      this.dispatch(statement);
    });
  }
}

// generate an evaluator that assigns the result of an expression
// to the last result scratch variable
export class ExpressionEvaluator extends NodeEvaluator {
  public static tags = ['expression'];
  public node: Syntax.ExpressionStatement;

  public evaluate() {
    this.coder.statement(() => {
      this.coder.assignResult(this.defer(this.node.expression));
    });
  }
}

export class OrEvaluator extends NodeEvaluator {
  public static tags = ['or'];
  public node: Syntax.OrOperator;

  public evaluate() {
    let leftAnon = this.coder.createAnonymous();
    this.coder.compoundExpression([
      () => {
        this.coder.assignAnonymous(leftAnon, this.defer(this.node.left));
      },
      () => {
        this.coder.conditionalOperator(
          leftAnon,
          leftAnon,
          this.defer(this.node.right)
        );
      }
    ]);
  }
}

export class AndEvaluator extends NodeEvaluator {
  public static tags = ['and'];
  public node: Syntax.AndOperator;

  public evaluate() {
    let leftAnon = this.coder.createAnonymous();
    this.coder.compoundExpression([
      () => {
        this.coder.assignAnonymous(leftAnon, this.defer(this.node.left));
      },
      () => {
        this.coder.conditionalOperator(
          leftAnon,
          this.defer(this.node.right),
          leftAnon
        );
      }
    ]);
  }
}

export class InEvaluator extends NodeEvaluator {
  public static tags = ['in'];
  public node: Syntax.InOperator;

  public evaluate() {
    let isIn = this.coder.runtimeImport('isIn');
    this.coder.call(isIn, [
      this.defer(this.node.left),
      this.defer(this.node.right)
    ]);
  }
}

export class NotInEvaluator extends NodeEvaluator {
  public static tags = ['notIn'];
  public node: Syntax.NotInOperator;

  public evaluate() {
    this.coder.unaryOperator('not', () => {
      let isIn = this.coder.runtimeImport('isIn');
      this.coder.call(isIn, [
        this.defer(this.node.left),
        this.defer(this.node.right)
      ]);
    });
  }
}

export class NotEvaluator extends NodeEvaluator {
  public static tags = ['not'];
  public node: Syntax.NotOperator;

  public evaluate() {
    this.coder.unaryOperator('not', () => {
      let isTrue = this.coder.runtimeImport('isTrue');
      this.coder.call(isTrue, [this.defer(this.node.left)]);
    });
  }
}

export class UnaryEvaluator extends NodeEvaluator {
  public static tags = ['neg', 'pos'];
  public node: Syntax.NegativeOperator;

  public evaluate() {
    this.coder.unaryOperator(this.node.tag, this.defer(this.node.left));
  }
}

export class FormatEvaluator extends NodeEvaluator {
  public static tags = ['format'];
  public node: Syntax.FormatOperator;

  public evaluate() {
    let formatStr = this.coder.literal((<Syntax.Literal>this.node.left).value);
    let formatter = this.coder.builder('buildFormatter', formatStr);
    this.coder.write(formatter);
  }
}

export class MemberEvaluator extends NodeEvaluator {
  public static tags = ['member'];
  public node: Syntax.MemberOperator;

  public evaluate() {
    this.coder.member(this.defer(this.node.left), this.defer(this.node.right));
  }
}

export class ArrayEvaluator extends NodeEvaluator {
  public static tags = ['array'];
  public node: Syntax.ArrayConstructor;

  public evaluate() {
    this.coder.array(
      this.node.elements.map(element => this.defer(element))
    );
  }
}

export class ObjectEvaluator extends NodeEvaluator {
  public static tags = ['object'];
  public node: Syntax.ObjectConstructor;

  public evaluate() {
    let elems = this.node.elements.map(elem => {
      let name: Target.BodyEntry;
      if ( elem.id instanceof Syntax.Literal ) {
        name = (<Syntax.Literal>elem.id).value;
      }
      else {
        name = this.defer(elem.id);
      }
      return [name, this.defer(elem.value), false];
    });
    this.coder.object(<Target.ObjectAssignmentItems>elems);
  }
}

export class IdEvaluator extends NodeEvaluator {
  public static tags = ['id'];
  public node: Syntax.Identifier;

  public evaluate() {
    this.coder.getter(this.node.value);
  }
}

export class LiteralEvaluator extends NodeEvaluator {
  public static tags = ['literal'];
  public node: Syntax.Literal;

  public evaluate() {
    let literal = this.coder.literal(this.node.value);
    this.coder.write(literal);
  }
}

export class ContextEvaluator extends NodeEvaluator {
  public static tags = ['context'];

  public evaluate() {
    let contextName = Syntax.getAnnotation(this.node, 'pattern/local');
    /* istanbul ignore next: the context pattern name is assigned already */
    if ( !contextName ) {
      throw new Error("Stupid Coder: Where's the context pattern name?");
    }
    contextName = this.coder.registerAnonymous(contextName);
    this.coder.retrieveAnonymous(contextName);
  }
}

export class SelfEvaluator extends NodeEvaluator {
  public static tags = ['self'];

  public evaluate() {
    this.coder.self();
  }
}

export class GlobalEvaluator extends NodeEvaluator {
  public static tags = ['global'];

  public evaluate() {
    this.coder.globalObject();
  }
}
