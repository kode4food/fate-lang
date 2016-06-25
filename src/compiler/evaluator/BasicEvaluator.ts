"use strict";

import * as Target from '../target';
import * as Syntax from '../syntax';
import { Evaluator } from './Evaluator';

export class BinaryEvaluator extends Evaluator {
  public static tags = [
    'eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'add', 'sub', 'mul', 'div', 'mod'
  ];

  public evaluate(node: Syntax.BinaryOperator) {
    this.coder.binaryOperator(
      node.tag,
      this.defer(node.left),
      this.defer(node.right)
    );
  }
}

export class StatementsEvaluator extends Evaluator {
  public static tags = ['statements'];

  public evaluate(node: Syntax.Statements) {
    node.statements.forEach(statement => {
      this.getRootEvaluator().evaluate(statement);
    });
  }
}

// generate an evaluator that assigns the result of an expression
// to the last result scratch variable
export class ExpressionEvaluator extends Evaluator {
  public static tags = ['expression'];

  public evaluate(node: Syntax.ExpressionStatement) {
    this.coder.statement(() => {
      this.coder.assignResult(this.defer(node.expression));
    });
  }
}

export class OrEvaluator extends Evaluator {
  public static tags = ['or'];

  public evaluate(node: Syntax.OrOperator) {
    let leftAnon = this.coder.createAnonymous();
    this.coder.compoundExpression([
      () => {
        this.coder.assignAnonymous(leftAnon, this.defer(node.left));
      },
      () => {
        this.coder.conditionalOperator(
          leftAnon,
          leftAnon,
          this.defer(node.right)
        );
      }
    ]);
  }
}

export class AndEvaluator extends Evaluator {
  public static tags = ['and'];

  public evaluate(node: Syntax.AndOperator) {
    let leftAnon = this.coder.createAnonymous();
    this.coder.compoundExpression([
      () => {
        this.coder.assignAnonymous(leftAnon, this.defer(node.left));
      },
      () => {
        this.coder.conditionalOperator(
          leftAnon,
          this.defer(node.right),
          leftAnon
        );
      }
    ]);
  }
}

export class InEvaluator extends Evaluator {
  public static tags = ['in'];

  public evaluate(node: Syntax.InOperator) {
    let isIn = this.coder.runtimeImport('isIn');
    this.coder.call(isIn, [this.defer(node.left), this.defer(node.right)]);
  }
}

export class NotInEvaluator extends Evaluator {
  public static tags = ['notIn'];

  public evaluate(node: Syntax.NotInOperator) {
    this.coder.unaryOperator('not', () => {
      let isIn = this.coder.runtimeImport('isIn');
      this.coder.call(isIn, [this.defer(node.left), this.defer(node.right)]);
    });
  }
}

export class NotEvaluator extends Evaluator {
  public static tags = ['not'];

  public evaluate(node: Syntax.NotOperator) {
    this.coder.unaryOperator('not', () => {
      let isTrue = this.coder.runtimeImport('isTrue');
      this.coder.call(isTrue, [this.defer(node.left)]);
    });
  }
}

export class UnaryEvaluator extends Evaluator {
  public static tags = ['neg', 'pos'];

  public evaluate(node: Syntax.NegativeOperator) {
    this.coder.unaryOperator(node.tag, this.defer(node.left));
  }
}

export class FormatEvaluator extends Evaluator {
  public static tags = ['format'];

  public evaluate(node: Syntax.FormatOperator) {
    let formatStr = this.coder.literal((<Syntax.Literal>node.left).value);
    let formatter = this.coder.builder('buildFormatter', formatStr);
    this.coder.write(formatter);
  }
}

export class MemberEvaluator extends Evaluator {
  public static tags = ['member'];

  public evaluate(node: Syntax.MemberOperator) {
    this.coder.member(this.defer(node.left), this.defer(node.right));
  }
}

export class ArrayEvaluator extends Evaluator {
  public static tags = ['array'];

  public evaluate(node: Syntax.ArrayConstructor) {
    this.coder.array(
      node.elements.map(element => this.defer(element))
    );
  }
}

export class ObjectEvaluator extends Evaluator {
  public static tags = ['object'];

  public evaluate(node: Syntax.ObjectConstructor) {
    let elems = node.elements.map(elem => {
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

export class IdEvaluator extends Evaluator {
  public static tags = ['id'];

  public evaluate(id: Syntax.Identifier) {
    this.coder.getter(id.value);
  }
}

export class LiteralEvaluator extends Evaluator {
  public static tags = ['literal'];

  public evaluate(node: Syntax.Literal) {
    let literal = this.coder.literal(node.value);
    this.coder.write(literal);
  }
}

export class ContextEvaluator extends Evaluator {
  public static tags = ['context'];

  public evaluate(node: Syntax.Context) {
    let contextName = Syntax.getAnnotation(node, 'pattern/local');
    /* istanbul ignore next: the context pattern name is assigned already */
    if ( !contextName ) {
      throw new Error("Stupid Coder: Where's the context pattern name?");
    }
    contextName = this.coder.registerAnonymous(contextName);
    this.coder.retrieveAnonymous(contextName);
  }
}

export class SelfEvaluator extends Evaluator {
  public static tags = ['self'];

  public evaluate(node: Syntax.Self) {
    this.coder.self();
  }
}

export class GlobalEvaluator extends Evaluator {
  public static tags = ['global'];

  public evaluate(node: Syntax.Self) {
    this.coder.context();
  }
}
