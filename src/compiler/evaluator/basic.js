/** @flow */

import type { Evaluator } from './evaluator';
import * as Target from '../target';
import * as Syntax from '../syntax';
import { NodeEvaluator } from './evaluator';

export class BinaryEvaluator extends NodeEvaluator {
  static tags = [
    'eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'add', 'sub', 'mul', 'div', 'mod',
  ];
  node: Syntax.BinaryOperator;

  constructor(parent: Evaluator, node: Syntax.BinaryOperator) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    this.coder.binaryOperator(
      this.node.tag,
      this.defer(this.node.left),
      this.defer(this.node.right),
    );
  }
}

export class StatementsEvaluator extends NodeEvaluator {
  static tags = ['statements'];
  node: Syntax.Statements;

  constructor(parent: Evaluator, node: Syntax.Statements) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    this.node.statements.forEach((statement) => {
      this.dispatch(statement);
    });
  }
}

// generate an evaluator that assigns the result of an expression
// to the last result scratch variable
export class ExpressionEvaluator extends NodeEvaluator {
  static tags = ['expression'];
  node: Syntax.ExpressionStatement;

  constructor(parent: Evaluator, node: Syntax.ExpressionStatement) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    this.coder.statement(() => {
      this.coder.assignResult(this.defer(this.node.expression));
    });
  }
}

export class OrEvaluator extends NodeEvaluator {
  static tags = ['or'];
  node: Syntax.OrOperator;

  constructor(parent: Evaluator, node: Syntax.OrOperator) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    this.coder.or(this.defer(this.node.left), this.defer(this.node.right));
  }
}

export class AndEvaluator extends NodeEvaluator {
  static tags = ['and'];
  node: Syntax.AndOperator;

  constructor(parent: Evaluator, node: Syntax.AndOperator) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    this.coder.and(this.defer(this.node.left), this.defer(this.node.right));
  }
}

export class InEvaluator extends NodeEvaluator {
  static tags = ['in'];
  node: Syntax.InOperator;

  constructor(parent: Evaluator, node: Syntax.InOperator) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    const isIn = this.coder.runtimeImport('isIn');
    this.coder.call(isIn, [
      this.defer(this.node.left),
      this.defer(this.node.right),
    ]);
  }
}

export class NotInEvaluator extends NodeEvaluator {
  static tags = ['notIn'];
  node: Syntax.NotInOperator;

  constructor(parent: Evaluator, node: Syntax.NotInOperator) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    this.coder.unaryOperator('not', () => {
      const isIn = this.coder.runtimeImport('isIn');
      this.coder.call(isIn, [
        this.defer(this.node.left),
        this.defer(this.node.right),
      ]);
    });
  }
}

export class NotEvaluator extends NodeEvaluator {
  static tags = ['not'];
  node: Syntax.NotOperator;

  constructor(parent: Evaluator, node: Syntax.NotOperator) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    this.coder.not(this.defer(this.node.left));
  }
}

export class UnaryEvaluator extends NodeEvaluator {
  static tags = ['neg', 'pos'];
  node: Syntax.NegativeOperator;

  constructor(parent: Evaluator, node: Syntax.NegativeOperator) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    this.coder.unaryOperator(this.node.tag, this.defer(this.node.left));
  }
}

export class FormatEvaluator extends NodeEvaluator {
  static tags = ['format'];
  node: Syntax.FormatOperator;

  constructor(parent: Evaluator, node: Syntax.FormatOperator) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    const formatStr = this.coder.literal(this.node.left.value);
    const formatter = this.coder.builder('buildFormatter', formatStr);
    this.coder.write(formatter);
  }
}

export class MemberEvaluator extends NodeEvaluator {
  static tags = ['member'];
  node: Syntax.MemberOperator;

  constructor(parent: Evaluator, node: Syntax.MemberOperator) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    this.coder.member(this.defer(this.node.left), this.defer(this.node.right));
  }
}

export class ArrayEvaluator extends NodeEvaluator {
  static tags = ['array'];
  node: Syntax.ArrayConstructor;

  constructor(parent: Evaluator, node: Syntax.ArrayConstructor) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    this.coder.array(
      this.node.elements.map(element => this.defer(element)),
    );
  }
}

export class ObjectEvaluator extends NodeEvaluator {
  static tags = ['object'];
  node: Syntax.ObjectConstructor;

  constructor(parent: Evaluator, node: Syntax.ObjectConstructor) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    const elems = this.node.elements.map((elem) => {
      let name: Target.BodyEntry;
      if (elem.id instanceof Syntax.Literal) {
        name = elem.id.value;
      } else {
        name = this.defer(elem.id);
      }
      return [name, this.defer(elem.value), false];
    });
    this.coder.object(elems);
  }
}

export class IdEvaluator extends NodeEvaluator {
  static tags = ['id'];
  node: Syntax.Identifier;

  constructor(parent: Evaluator, node: Syntax.Identifier) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    this.coder.getter(this.node.value);
  }
}

export class LiteralEvaluator extends NodeEvaluator {
  static tags = ['literal'];
  node: Syntax.Literal;

  constructor(parent: Evaluator, node: Syntax.Literal) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    const literal = this.coder.literal(this.node.value);
    this.coder.write(literal);
  }
}

export class ContextEvaluator extends NodeEvaluator {
  static tags = ['context'];
  node: Syntax.Node;

  constructor(parent: Evaluator, node: Syntax.Node) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    let contextName = Syntax.getAnnotation(this.node, 'pattern/local');
    if (!contextName) {
      throw new Error("Stupid Coder: Where's the context pattern name?");
    }
    contextName = this.coder.registerAnonymous(contextName);
    this.coder.retrieveAnonymous(contextName);
  }
}

export class SelfEvaluator extends NodeEvaluator {
  static tags = ['self'];
  node: Syntax.Node;

  constructor(parent: Evaluator, node: Syntax.Node) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    this.coder.self();
  }
}

export class GlobalEvaluator extends NodeEvaluator {
  static tags = ['global'];
  node: Syntax.Node;

  constructor(parent: Evaluator, node: Syntax.Node) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    this.coder.globalObject();
  }
}
