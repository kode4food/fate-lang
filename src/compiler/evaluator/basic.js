/** @flow */

import * as Target from '../target';
import * as Syntax from '../syntax';
import { NodeEvaluator } from './evaluator';

export class BinaryEvaluator extends NodeEvaluator {
  node: Syntax.BinaryOperator;

  evaluate() {
    this.coder.binaryOperator(
      this.node.tag,
      this.defer(this.node.left),
      this.defer(this.node.right)
    );
  }
}
BinaryEvaluator.tags = [
  'eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'add', 'sub', 'mul', 'div', 'mod'
];

export class StatementsEvaluator extends NodeEvaluator {
  node: Syntax.Statements;

  evaluate() {
    this.node.statements.forEach(statement => {
      this.dispatch(statement);
    });
  }
}
StatementsEvaluator.tags = ['statements'];

// generate an evaluator that assigns the result of an expression
// to the last result scratch variable
export class ExpressionEvaluator extends NodeEvaluator {
  node: Syntax.ExpressionStatement;

  evaluate() {
    this.coder.statement(() => {
      this.coder.assignResult(this.defer(this.node.expression));
    });
  }
}
ExpressionEvaluator.tags = ['expression'];

export class OrEvaluator extends NodeEvaluator {
  node: Syntax.OrOperator;

  evaluate() {
    this.coder.or(this.defer(this.node.left), this.defer(this.node.right));
  }
}
OrEvaluator.tags = ['or'];

export class AndEvaluator extends NodeEvaluator {
  node: Syntax.AndOperator;

  evaluate() {
    this.coder.and(this.defer(this.node.left), this.defer(this.node.right));
  }
}
AndEvaluator.tags = ['and'];

export class InEvaluator extends NodeEvaluator {
  node: Syntax.InOperator;

  evaluate() {
    let isIn = this.coder.runtimeImport('isIn');
    this.coder.call(isIn, [
      this.defer(this.node.left),
      this.defer(this.node.right)
    ]);
  }
}
InEvaluator.tags = ['in'];

export class NotInEvaluator extends NodeEvaluator {
  node: Syntax.NotInOperator;

  evaluate() {
    this.coder.unaryOperator('not', () => {
      let isIn = this.coder.runtimeImport('isIn');
      this.coder.call(isIn, [
        this.defer(this.node.left),
        this.defer(this.node.right)
      ]);
    });
  }
}
NotInEvaluator.tags = ['notIn'];

export class NotEvaluator extends NodeEvaluator {
  node: Syntax.NotOperator;

  evaluate() {
    this.coder.not(this.defer(this.node.left));
  }
}
NotEvaluator.tags = ['not'];

export class UnaryEvaluator extends NodeEvaluator {
  node: Syntax.NegativeOperator;

  evaluate() {
    this.coder.unaryOperator(this.node.tag, this.defer(this.node.left));
  }
}
UnaryEvaluator.tags = ['neg', 'pos'];

export class FormatEvaluator extends NodeEvaluator {
  node: Syntax.FormatOperator;

  evaluate() {
    let formatStr = this.coder.literal(this.node.left.value);
    let formatter = this.coder.builder('buildFormatter', formatStr);
    this.coder.write(formatter);
  }
}
FormatEvaluator.tags = ['format'];

export class MemberEvaluator extends NodeEvaluator {
  node: Syntax.MemberOperator;

  evaluate() {
    this.coder.member(this.defer(this.node.left), this.defer(this.node.right));
  }
}
MemberEvaluator.tags = ['member'];

export class ArrayEvaluator extends NodeEvaluator {
  node: Syntax.ArrayConstructor;

  evaluate() {
    this.coder.array(
      this.node.elements.map(element => this.defer(element))
    );
  }
}
ArrayEvaluator.tags = ['array'];

export class ObjectEvaluator extends NodeEvaluator {
  node: Syntax.ObjectConstructor;

  evaluate() {
    let elems = this.node.elements.map(elem => {
      let name: Target.BodyEntry;
      if ( elem.id instanceof Syntax.Literal ) {
        name = elem.id.value;
      }
      else {
        name = this.defer(elem.id);
      }
      return [name, this.defer(elem.value), false];
    });
    this.coder.object(elems);
  }
}
ObjectEvaluator.tags = ['object'];

export class IdEvaluator extends NodeEvaluator {
  node: Syntax.Identifier;

  evaluate() {
    this.coder.getter(this.node.value);
  }
}
IdEvaluator.tags = ['id'];

export class LiteralEvaluator extends NodeEvaluator {
  node: Syntax.Literal;

  evaluate() {
    let literal = this.coder.literal(this.node.value);
    this.coder.write(literal);
  }
}
LiteralEvaluator.tags = ['literal'];

export class ContextEvaluator extends NodeEvaluator {
  evaluate() {
    let contextName = Syntax.getAnnotation(this.node, 'pattern/local');
    if ( !contextName ) {
      throw new Error("Stupid Coder: Where's the context pattern name?");
    }
    contextName = this.coder.registerAnonymous(contextName);
    this.coder.retrieveAnonymous(contextName);
  }
}
ContextEvaluator.tags = ['context'];

export class SelfEvaluator extends NodeEvaluator {
  evaluate() {
    this.coder.self();
  }
}
SelfEvaluator.tags = ['self'];

export class GlobalEvaluator extends NodeEvaluator {
  evaluate() {
    this.coder.globalObject();
  }
}
GlobalEvaluator.tags = ['global'];
