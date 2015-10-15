/// <reference path="./Annotations.ts"/>

"use strict";

namespace Fate.Compiler.Syntax {
  import Annotations = Compiler.Annotations;

  export type Tag = string;
  export type Tags = Tag[];
  export type TagOrTags = Tag|Tags;
  export type Nodes = Node[];
  export type NodeOrNodes = Node|Nodes;
  export type Ranges = Range[];
  export type Signatures = Signature[];
  export type Parameters = Parameter[];
  export type Expressions = Expression[];
  export type Assignments = Assignment[];
  export type ModuleItems = ModuleItem[];
  export type ModuleSpecifiers = ModuleSpecifier[];
  export type ArrayElement = Expression|Pattern;
  export type ArrayElements = ArrayElement[];
  export type ObjectElements = ObjectAssignment[];

  type FunctionMap = { [index: string]: Function };

  export function node(tag: Tag, ...args: any[]) {
    var constructor = tagToConstructor[tag];
    var instance = Object.create(constructor.prototype);
    instance.tag = tag;
    var result = constructor.apply(instance, args);
    return result !== undefined ? result : instance;
  }

  export class Node implements Annotated {
    [index: string]: any;

    public tag: Tag;
    public annotations: Annotations;
    public line: number;
    public column: number;
    public length: number;

    public dump() {
      return require('util').inspect(this, { depth: null });
    }

    public template(...args: any[]) {
      var result = node.apply(null, args);
      result.line = this.line;
      result.column = this.column;
      result.length = this.length;
      return result;
    }
  }

  export function hasTag(node: Node, tags?: TagOrTags): any {
    if ( !(node instanceof Node) ) {
      return false;
    }

    if ( tags === undefined || tags === '*' ) {
      return node.tag;
    }

    if ( !Array.isArray(tags) ) {
      return tags === node.tag;
    }

    var idx = tags.indexOf(node.tag);
    if ( idx === -1 ) {
      if ( tags.indexOf('*') !== -1 ) {
        return node.tag;
      }
      return false;
    }
    return tags[idx];
  }

  // Expression Nodes *********************************************************

  export class Expression extends Node {}
  export class Operator extends Expression {}

  export class UnaryOperator extends Operator {
    constructor(public left: Expression) { super(); }
  }

  export class FormatOperator extends UnaryOperator {}
  export class PositiveOperator extends UnaryOperator {}
  export class NegativeOperator extends UnaryOperator {}
  export class NotOperator extends UnaryOperator {}
  export class Pattern extends UnaryOperator { }

  export class BinaryOperator extends Operator {
    constructor(public left: Expression,
                public right: Expression) { super(); }
  }

  export class RelationalOperator extends BinaryOperator {}
  export class LikeOperator extends RelationalOperator {}
  export class NotEqualOperator extends RelationalOperator {}
  export class EqualOperator extends RelationalOperator {}
  export class GreaterOrEqualOperator extends RelationalOperator {}
  export class GreaterOperator extends RelationalOperator {}
  export class LessOrEqualOperator extends RelationalOperator {}
  export class LessThanOperator extends RelationalOperator {}
  export class InOperator extends RelationalOperator {}
  export class NotInOperator extends RelationalOperator {}

  export class OrOperator extends BinaryOperator {}
  export class AndOperator extends BinaryOperator {}
  export class AddOperator extends BinaryOperator {}
  export class SubtractOperator extends BinaryOperator {}
  export class MultiplyOperator extends BinaryOperator {}
  export class DivideOperator extends BinaryOperator {}
  export class ModuloOperator extends BinaryOperator {}
  export class MemberOperator extends BinaryOperator {}

  export class ConditionalOperator extends Operator {
    constructor(public condition: Expression,
                public trueResult: Expression,
                public falseResult: Expression) { super(); }
  }

  export class CallOperator extends Operator {
    constructor(public left: Expression,
                public right: Expressions) { super(); }
  }

  export class BindOperator extends Operator {
    constructor(public left: Expression,
                public right: (Expression|Wildcard)[]) { super(); }
  }

  // Array/Object Construction and Comprehension ******************************

  export class ElementsConstructor extends Operator {
    constructor(public elements: ArrayElements|ObjectElements) { super(); }
  }

  export class ArrayConstructor extends ElementsConstructor {
    constructor(public elements: ArrayElements) { super(elements); }
  }

  export class ObjectConstructor extends ElementsConstructor {
    constructor(public elements: ObjectElements) { super(elements); }
  }

  export class ListComprehension extends Operator {
    constructor(public ranges: Ranges) { super(); }
  }

  export class ArrayComprehension extends ListComprehension {
    constructor(ranges: Ranges, public value: Expression) {
      super(ranges);
      if ( !value ) {
        this.value = ranges[0].valueId;
      }
    }
  }

  export class ObjectComprehension extends ListComprehension {
    constructor(ranges: Ranges, public assignment: ObjectAssignment) {
      super(ranges);
      if ( !assignment ) {
        var range = ranges[0];
        this.assignment = range.template('objectAssignment',
          range.nameId,
          range.valueId
        );
      }
    }
  }

  // Statement Nodes **********************************************************

  export class Statement extends Node {}

  export class Statements extends Node {
    constructor(public statements: Statement[]) { super(); }

    public isEmpty() {
      return this.statements.length === 0;
    }
  }

  export function isStatements(node: Node) {
    return node instanceof Statements;
  }

  export class ExpressionStatement extends Statement {
    constructor(public expression: Expression) { super(); }
  }

  export class IfStatement extends Statement {
    constructor(public condition: Expression,
                public thenStatements: Statements,
                public elseStatements: Statements) { super(); }
  }

  export class ForStatement extends Statement {
    constructor(public ranges: Ranges,
                public loopStatements: Statements,
                public elseStatements: Statements) { super(); }
  }

  export class LetStatement extends Statement {
    constructor(public assignments: Assignments) { super(); }
  }

  export class FromStatement extends Statement {
    constructor(public modulePath: ModulePath,
                public importList: ModuleItems) { super(); }
  }

  export class ImportStatement extends Statement {
    constructor(public modules: ModuleSpecifiers) { super(); }
  }

  export class ExportStatement extends Statement {
    constructor(public exportList: ModuleItems) { super(); }
  }

  export class ChannelDeclaration extends Statement {
    constructor(public signatures: Signatures,
                public statements: Statements) { super(); }
  }

  export class FunctionDeclaration extends Statement {
    constructor(public signature: Signature,
                public statements: Statements) { super(); }
  }

  export class ReturnStatement extends Statement {
    constructor(public result: Expression) { super(); }
  }

  // Symbol Nodes *************************************************************

  export class Symbol extends Node {}
  export class Wildcard extends Symbol {}

  export class Identifier extends Symbol {
    constructor(public value: string) { super(); }
  }

  export class Self extends Identifier { }

  export class Literal extends Symbol {
    constructor(public value: any) { super(); }
  }

  export function isLiteral(node: Node) {
    return node instanceof Literal;
  }

  // Supporting Nodes *********************************************************

  export class Range extends Node {
    constructor(public valueId: Identifier,
                public nameId: Identifier,
                public collection: Expression,
                public guard: Expression) {
      super();
      if ( !nameId ) {
        this.nameId = valueId.template('id', 1);
      }
    }
  }

  export class Signature extends Node {
    public params: Parameters = [];

    constructor(public id: Identifier,
                paramDefs: Parameters,
                public guard: Expression) {
      super();
      var guards: Expressions = [];

      // Generate Guards from the Parameters
      (paramDefs || []).forEach((paramDef, idx) => {
        if ( !(paramDef instanceof PatternParameter) ) {
          this.params.push(paramDef);
          return;
        }

        var id = paramDef.id || <Identifier>node('id', idx);
        this.params.push(node('idParam', id));
        guards.push(node('like', id, (<PatternParameter>paramDef).pattern));
      });

      // Combine the Guards
      if ( guards.length ) {
        if ( this.guard ) {
          // Push it to the end of the list
          guards.push(this.guard);
        }
        this.guard = guards.shift();
        guards.forEach((guard) => {
          this.guard = node('and', this.guard, guard);
        });
      }
    }
  }

  export class Parameter extends Node {
    constructor(public id: Identifier) { super(); }
  }

  export class PatternParameter extends Parameter {
    constructor(id: Identifier, public pattern: Expression) {
      super(id);
    }
  }

  export class ModuleItem extends Node {
    constructor(public name: Identifier,
                public alias: Identifier) {
      super();
      if ( !alias ) {
        this.alias = name;
      }
    }
  }

  export class ModuleSpecifier extends Node {
    constructor(public path: ModulePath,
                public alias: Identifier) {
      super();
      if ( !alias ) {
        this.alias = node('id', path.value.split('/').pop());
      }
    }
  }

  export class ModulePath extends Identifier {}

  export class Assignment extends Node {
    constructor(public id: Identifier,
                public value: Expression) { super(); }
  }

  export class ObjectAssignment extends Node {
    constructor(public id: Expression,
                public value: Expression|Wildcard) { super(); }
  }

  // Tag to Constructor Mapping ***********************************************

  var tagToConstructor: FunctionMap = {
    'from': FromStatement,
    'import': ImportStatement,
    'export': ExportStatement,
    'channel': ChannelDeclaration,
    'function': FunctionDeclaration,
    'call': CallOperator,
    'bind': BindOperator,
    'let': LetStatement,
    'return': ReturnStatement,
    'expression': ExpressionStatement,
    'arrayComp': ArrayComprehension,
    'objectComp': ObjectComprehension,
    'for': ForStatement,
    'conditional': ConditionalOperator,
    'if': IfStatement,
    'or': OrOperator,
    'and': AndOperator,
    'like': LikeOperator,
    'eq': EqualOperator,
    'neq': NotEqualOperator,
    'in': InOperator,
    'notIn': NotInOperator,
    'gt': GreaterOperator,
    'lt': LessThanOperator,
    'gte': GreaterOrEqualOperator,
    'lte': LessOrEqualOperator,
    'add': AddOperator,
    'sub': SubtractOperator,
    'mul': MultiplyOperator,
    'div': DivideOperator,
    'mod': ModuloOperator,
    'not': NotOperator,
    'neg': NegativeOperator,
    'pos': PositiveOperator,
    'format': FormatOperator,
    'member': MemberOperator,
    'array': ArrayConstructor,
    'object': ObjectConstructor,
    'id':  Identifier,
    'self': Self,
    'lit': Literal,
    'pattern': Pattern,
    'wildcard': Wildcard,
    'statements': Statements,
    'range': Range,
    'signature': Signature,
    'idParam': Parameter,
    'patternParam': PatternParameter,
    'moduleItem': ModuleItem,
    'moduleSpecifier': ModuleSpecifier,
    'modulePath': ModulePath,
    'assignment': Assignment,
    'objectAssignment': ObjectAssignment
  };
}
