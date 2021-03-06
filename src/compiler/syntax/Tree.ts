"use strict";

import { Annotated, Annotations } from './Annotation';
import { node, Tag, TagOrTags } from './index';

const isArray = Array.isArray;

export type Nodes = Node[];
export type NodeOrNodes = Node|Nodes;
export type Ranges = Range[];
export type Signatures = Signature[];
export type Parameters = Parameter[];
export type Identifiers = Identifier[];
export type Expressions = Expression[];
export type Assignments = Assignment[];
export type ImportModuleItems = ImportModuleItem[];
export type ExportModuleItems = ExportModuleItem[];
export type ModuleSpecifiers = ModuleSpecifier[];
export type ArrayElements = ArrayElement[];
export type ArrayElement = Expression;
export type ObjectElements = ObjectAssignment[];

export type CollectionPatternElement = Expression|PatternElement;
export type CollectionPatternElements = CollectionPatternElement[];

export class Node implements Annotated {
  [index: string]: any;

  public tag: Tag;
  public visitorKeys: string[];
  public annotations: Annotations;
  public line: number;
  public column: number;
  public length: number;

  public template(...args: any[]) {
    let result = node.apply(null, args);
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

  if ( tags === undefined ) {
    return node.tag;
  }

  if ( isArray(tags) ) {
    let idx = tags.indexOf(node.tag);
    if ( idx === -1 ) {
      return false;
    }
    return tags[idx];
  }

  return tags === node.tag;
}

// Expression Nodes *********************************************************

export class Expression extends Node {}
export class Operator extends Expression {}

export class Parens extends Expression {
  constructor(public left: Expression) { super(); }
}

export class UnaryOperator extends Operator {
  constructor(public left: Expression) { super(); }
}

export class FormatOperator extends UnaryOperator {}
export class PositiveOperator extends UnaryOperator {}
export class NegativeOperator extends UnaryOperator {}
export class NotOperator extends UnaryOperator {}
export class Pattern extends UnaryOperator {}

export enum Resolver {
  Value, Any, All
}

export class AwaitOperator extends UnaryOperator {
  constructor(left: Expression, public resolver: Resolver) {
    super(left);
  }
}

export class BinaryOperator extends Operator {
  constructor(public left: Expression,
              public right: Expression) { super(); }
}

export class RelationalOperator extends BinaryOperator {}
export class LikeOperator extends RelationalOperator {}
export class NotLikeOperator extends RelationalOperator {}
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

export interface FunctionOrLambda extends Annotated {
  signature: Signature;
  statements: Statements;
}

export class LambdaExpression extends Expression
                              implements FunctionOrLambda {
  constructor(public signature: Signature,
              public statements: Statements) { super(); }
}

export class ComposeExpression extends Expression {
  constructor(public expressions: Expressions) { super(); }
}

export class ComposeOrExpression extends ComposeExpression {}
export class ComposeAndExpression extends ComposeExpression {}

export class ReduceExpression extends Expression {
  constructor(public assignment: DirectAssignment,
              public ranges: Ranges,
              public select: Select) { super(); }
}

export class ForExpression extends Expression {
  constructor(public ranges: Ranges, public select: Select) {
    super();
    if ( !select ) {
      let range = ranges[0];
      this.select = range.template('select', range.valueId, range.nameId);
    }
  }
}

type WhenClause = LetStatement|Expression;

export class DoExpression extends Expression {
  public visitorKeys = ['whenClause', 'statements'];

  constructor(public statements: Statements,
              public whenClause?: WhenClause) { super(); }
}

export class CaseExpression extends Expression {
  constructor(public cases: DoExpression[]) { super(); }
}

export class MatchExpression extends Expression {
  constructor(public value: Expression,
              public matches: MatchClause[],
              public elseStatements: Statements) { super(); }
}

export class MatchClause extends Node {
  constructor(public pattern: Pattern,
              public statements: Statements) { super(); }
}

export class GenerateExpression extends Expression {
  constructor(public statements: Statements) { super(); }
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
  constructor(public forExpression: ForExpression) { super(); }
}

export class ArrayComprehension extends ListComprehension {}
export class ObjectComprehension extends ListComprehension {}

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

export class IfLetStatement extends Statement {
  constructor(public condition: LetStatement,
              public thenStatements: Statements,
              public elseStatements: Statements) { super(); }
}

export class ReturnStatement extends Statement {
  constructor(public result: Expression) { super(); }
}

export class EmitStatement extends Statement {
  constructor(public value: Expression) { super(); }
}

export abstract class ExportableStatement extends Statement {
  public abstract getModuleItems(): ExportModuleItems;
}

export class ForStatement extends ExportableStatement {
  public visitorKeys = [
    'reduceAssignments', 'ranges', 'loopStatements', 'elseStatements'
  ];

  constructor(public ranges: Ranges,
              public loopStatements: Statements,
              public elseStatements: Statements,
              public reduceAssignments?: Assignment[]) { super(); }

  public getReduceIdentifiers() {
    let result: Identifiers = [];
    this.reduceAssignments.forEach(assignment => {
      assignment.getIdentifiers().forEach(id => {
        result.push(id);
      });
    });
    return result;
  }

  public getModuleItems() {
    if ( this.reduceAssignments ) {
      let result: ExportModuleItems = [];
      this.getReduceIdentifiers().forEach(id => {
        result.push(id.template('exportModuleItem', id));
      });
      return result;
    }
    return [];
  }
}

export class LetStatement extends ExportableStatement {
  constructor(public assignments: Assignments) { super(); }

  public getModuleItems() {
    let result: ExportModuleItems = [];
    this.assignments.forEach(assignment => {
      assignment.getIdentifiers().forEach(id => {
        result.push(id.template('exportModuleItem', id));
      });
    });
    return result;
  }
}

export class FromStatement extends ExportableStatement {
  constructor(public path: ModulePath,
              public importList: ImportModuleItems) { super(); }

  public getModuleItems() {
    return this.importList.map(
      moduleItem => node('exportModuleItem', moduleItem.id)
    );
  }
}

export class ImportStatement extends ExportableStatement {
  constructor(public modules: ModuleSpecifiers) { super(); }

  public getModuleItems() {
    return this.modules.map(
      moduleSpecifier => node('exportModuleItem', moduleSpecifier.alias)
    );
  }
}

export class FunctionDeclaration extends ExportableStatement
                                 implements FunctionOrLambda  {
  constructor(public signature: Signature,
              public statements: Statements) { super(); }

  public getModuleItems() {
    return [node('exportModuleItem', this.signature.id)];
  }
}

export class ExportStatement extends Statement {
  public statement: ExportableStatement;
  public exportItems: ExportModuleItems;

  constructor(exportable: ExportableStatement|ExportModuleItems) {
    super();

    if ( isArray(exportable) ) {
      this.exportItems = exportable;
    }
    else {
      this.statement = exportable;
      this.exportItems = exportable.getModuleItems();
    }
  }
}

// Symbol Nodes *************************************************************

export class Symbol extends Node {}

export class Identifier extends Symbol {
  constructor(public value: string) { super(); }
}

export class Wildcard extends Identifier {}
export class Context extends Identifier {}
export class Self extends Identifier {}
export class Global extends Identifier {}

export class Literal extends Symbol {
  constructor(public value: any) { super(); }
}

export function isLiteral(node: Node) {
  return node instanceof Literal;
}

export class PatternSymbol extends Symbol {}

export class Regex extends PatternSymbol {
  public value: RegExp;

  constructor(pattern: string, flags: string) {
    super();
    this.value = new RegExp(pattern, flags);
  }
}

export class CollectionPattern extends PatternSymbol {
  constructor(public elements: CollectionPatternElements) {
    super();
  }
}

export class ObjectPattern extends CollectionPattern {}
export class ArrayPattern extends CollectionPattern {}

export class PatternElement extends PatternSymbol {
  constructor(public id: Expression,
              public value: CollectionPattern|Expression) { super(); }
}

// Supporting Nodes *********************************************************

export class Range extends Node {
  constructor(public valueId: Identifier,
              public nameId: Identifier,
              public collection: Expression,
              public guard: Expression) { super(); }
}

export class Signature extends Node {
  constructor(public id: Identifier,
              public params: Parameters,
              public guard: Expression) {
    super();
    if ( !params ) {
      this.params = [];
    }
  }
}

export enum Cardinality {
  Required, ZeroToMany
}

export class Parameter extends Node {
  constructor(public id: Identifier,
              public cardinality: Cardinality) {
    super();
    if ( !cardinality ) {
      this.cardinality = Cardinality.Required;
    }
  }
}

export class PatternParameter extends Parameter {
  constructor(id: Identifier, public pattern: Pattern,
              cardinality: Cardinality) {
    super(id, cardinality);
  }
}

export class ImportModuleItem extends Node {
  constructor(public moduleKey: Literal,
              public id: Identifier) { super(); }
}

export class ExportModuleItem extends Node {
  constructor(public id: Identifier,
              public moduleKey: Literal) {
    super();
    if ( !moduleKey ) {
      this.moduleKey = id.template('literal', id.value);
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

export abstract class Assignment extends Node {
  constructor(public value: Expression) { super(); }
  public abstract getIdentifiers(): Identifiers;
}

export class DirectAssignment extends Assignment {
  constructor(public id: Identifier, value: Expression) {
    super(value);
  }

  public getIdentifiers() {
    return [this.id];
  }
}

export class ArrayDestructure extends Assignment {
  constructor(public ids: Identifiers, value: Expression) {
    super(value);
  }

  public getIdentifiers() {
    return this.ids;
  }
}

export class ObjectDestructure extends Assignment {
  constructor(public items: ObjectDestructureItem[], value: Expression) {
    super(value);
  }

  public getIdentifiers() {
    return this.items.map(item => item.id);
  }
}

export class ObjectDestructureItem extends Node {
  constructor(public id: Identifier,
              public value: Expression) { super(); }
}

export class ObjectAssignment extends Node {
  constructor(public id: Expression,
              public value: Expression) { super(); }
}

export class Select extends Node {
  constructor(public value: Expression,
              public name?: Expression) { super(); }
}
