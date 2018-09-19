/** @flow */

import type { Tag, TagOrTags } from './index';
import type { Annotated, Annotations } from './annotation';
import { node } from './index';

const { isArray } = Array;

export type Nodes = Node[];
export type NodeOrNodes = Node | Nodes;
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

export type CollectionPatternElement = Expression | PatternElement;
export type CollectionPatternElements = CollectionPatternElement[];

export class Node {
  tag: Tag;
  visitorKeys: string[];
  annotations: Annotations;
  line: number;
  column: number;
  length: number;

  template(...args: any[]) {
    const result = node(...args);
    result.line = this.line;
    result.column = this.column;
    result.length = this.length;
    return result;
  }
}

export function hasTag(n: Node, tags?: TagOrTags): any {
  if (!(n instanceof Node)) {
    return false;
  }

  if (tags === undefined) {
    return n.tag;
  }

  if (isArray(tags)) {
    const idx = tags.indexOf(n.tag);
    if (idx === -1) {
      return false;
    }
    return tags[idx];
  }

  return tags === n.tag;
}

// Expression Nodes *********************************************************

export class Expression extends Node {}
export class Operator extends Expression {}

export class Parens extends Expression {
  left: Expression;

  constructor(left: Expression) {
    super();
    this.left = left;
  }
}

export class UnaryOperator extends Operator {
  left: Expression;

  constructor(left: Expression) {
    super();
    this.left = left;
  }
}

export class FormatOperator extends UnaryOperator {}
export class PositiveOperator extends UnaryOperator {}
export class NegativeOperator extends UnaryOperator {}
export class NotOperator extends UnaryOperator {}
export class Pattern extends UnaryOperator {}

export const Resolver = {
  Value: 0,
  Any: 1,
  All: 2,
};

export type ResolverValue = $Values<typeof Resolver>;

export class AwaitOperator extends UnaryOperator {
  resolver: ResolverValue;

  constructor(left: Expression, resolver: ResolverValue) {
    super(left);
    this.resolver = resolver;
  }
}

export class BinaryOperator extends Operator {
  left: Expression;
  right: Expression;

  constructor(left: Expression, right: Expression) {
    super();
    this.left = left;
    this.right = right;
  }
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
  condition: Expression;
  trueResult: Expression;
  falseResult: Expression;

  constructor(condition: Expression, trueResult: Expression,
              falseResult: Expression) {
    super();
    this.condition = condition;
    this.trueResult = trueResult;
    this.falseResult = falseResult;
  }
}

export class CallOperator extends Operator {
  left: Expression;
  right: Expressions;

  constructor(left: Expression, right: Expressions) {
    super();
    this.left = left;
    this.right = right;
  }
}

export class BindOperator extends Operator {
  left: Expression;
  right: (Expression | Wildcard)[];

  constructor(left: Expression, right: (Expression | Wildcard)[]) {
    super();
    this.left = left;
    this.right = right;
  }
}

export type FunctionOrLambda = Annotated & {
  signature: Signature;
  statements: Statements;
}

export class LambdaExpression extends Expression {
  signature: Signature;
  statements: Statements;

  constructor(signature: Signature, statements: Statements) {
    super();
    this.signature = signature;
    this.statements = statements;
  }
}

export class ComposeExpression extends Expression {
  expressions: Expressions;

  constructor(expressions: Expressions) {
    super();
    this.expressions = expressions;
  }
}

export class ComposeOrExpression extends ComposeExpression {}
export class ComposeAndExpression extends ComposeExpression {}

export class ReduceExpression extends Expression {
  assignment: DirectAssignment;
  ranges: Ranges;
  select: Select;

  constructor(assignment: DirectAssignment, ranges: Ranges, select: Select) {
    super();
    this.assignment = assignment;
    this.ranges = ranges;
    this.select = select;
  }
}

export class ForExpression extends Expression {
  ranges: Ranges;
  select: Select;

  constructor(ranges: Ranges, select: Select) {
    super();
    this.ranges = ranges;
    this.select = select;
    if (!select) {
      const range = ranges[0];
      this.select = range.template('select', range.valueId, range.nameId);
    }
  }
}

type WhenClause = LetStatement | Expression;

export class DoExpression extends Expression {
  visitorKeys = ['whenClause', 'statements'];
  statements: Statements;
  whenClause: ?WhenClause;

  constructor(statements: Statements, whenClause?: WhenClause) {
    super();
    this.statements = statements;
    this.whenClause = whenClause;
  }
}

export class CaseExpression extends Expression {
  cases: DoExpression[];

  constructor(cases: DoExpression[]) {
    super();
    this.cases = cases;
  }
}

export class MatchExpression extends Expression {
  value: Expression;
  matches: MatchClause[];
  elseStatements: Statements;

  constructor(value: Expression, matches: MatchClause[],
              elseStatements: Statements) {
    super();
    this.value = value;
    this.matches = matches;
    this.elseStatements = elseStatements;
  }
}

export class MatchClause extends Node {
  pattern: Pattern;
  statements: Statements;

  constructor(pattern: Pattern, statements: Statements) {
    super();
    this.pattern = pattern;
    this.statements = statements;
  }
}

export class GenerateExpression extends Expression {
  statements: Statements;

  constructor(statements: Statements) {
    super();
    this.statements = statements;
  }
}

// Array/Object Construction and Comprehension ******************************

export class ElementsConstructor extends Operator {
  elements: ArrayElements | ObjectElements;

  constructor(elements: ArrayElements | ObjectElements) {
    super();
    this.elements = elements;
  }
}

export class ArrayConstructor extends ElementsConstructor {}
export class ObjectConstructor extends ElementsConstructor {}

export class ListComprehension extends Operator {
  forExpression: ForExpression;

  constructor(forExpression: ForExpression) {
    super();
    this.forExpression = forExpression;
  }
}

export class ArrayComprehension extends ListComprehension {}
export class ObjectComprehension extends ListComprehension {}

// Statement Nodes **********************************************************

export class Statement extends Node {}

export class Statements extends Node {
  statements: Statement[];

  constructor(statements: Statement[]) {
    super();
    this.statements = statements;
  }

  isEmpty() {
    return this.statements.length === 0;
  }
}

export function isStatements(n: Node) {
  return n instanceof Statements;
}

export class ExpressionStatement extends Statement {
  expression: Expression;

  constructor(expression: Expression) {
    super();
    this.expression = expression;
  }
}

export class IfStatement extends Statement {
  condition: Expression;
  thenStatements: Statements;
  elseStatements: Statements;

  constructor(condition: Expression, thenStatements: Statements,
              elseStatements: Statements) {
    super();
    this.condition = condition;
    this.thenStatements = thenStatements;
    this.elseStatements = elseStatements;
  }
}

export class IfLetStatement extends Statement {
  condition: LetStatement;
  thenStatements: Statements;
  elseStatements: Statements;

  constructor(condition: LetStatement, thenStatements: Statements,
              elseStatements: Statements) {
    super();
    this.condition = condition;
    this.thenStatements = thenStatements;
    this.elseStatements = elseStatements;
  }
}

export class ReturnStatement extends Statement {
  result: Expression;

  constructor(result: Expression) {
    super();
    this.result = result;
  }
}

export class EmitStatement extends Statement {
  value: Expression;

  constructor(value: Expression) {
    super();
    this.value = value;
  }
}

export class ExportableStatement extends Statement {
  // eslint-disable-next-line class-methods-use-this
  getModuleItems(): ExportModuleItems {
    throw new Error('Stupid Coder: ExportableStatement is abstract');
  }
}

export class ForStatement extends ExportableStatement {
  visitorKeys = [
    'reduceAssignments', 'ranges', 'loopStatements', 'elseStatements',
  ];
  ranges: Ranges;
  loopStatements: Statements;
  elseStatements: Statements;
  reduceAssignments: ?Assignment[];

  constructor(ranges: Ranges, loopStatements: Statements,
              elseStatements: Statements, reduceAssignments?: Assignment[]) {
    super();
    this.ranges = ranges;
    this.loopStatements = loopStatements;
    this.elseStatements = elseStatements;
    this.reduceAssignments = reduceAssignments;
  }

  getReduceIdentifiers(): Identifiers {
    const result: Identifiers = [];
    if (!this.reduceAssignments) {
      return result;
    }
    this.reduceAssignments.forEach((assignment) => {
      assignment.getIdentifiers().forEach((id) => {
        result.push(id);
      });
    });
    return result;
  }

  getModuleItems() {
    if (this.reduceAssignments) {
      const result: ExportModuleItems = [];
      this.getReduceIdentifiers().forEach((id) => {
        result.push(id.template('exportModuleItem', id));
      });
      return result;
    }
    return [];
  }
}

export class LetStatement extends ExportableStatement {
  assignments: Assignments;

  constructor(assignments: Assignments) {
    super();
    this.assignments = assignments;
  }

  getModuleItems() {
    const result: ExportModuleItems = [];
    this.assignments.forEach((assignment) => {
      assignment.getIdentifiers().forEach((id) => {
        result.push(id.template('exportModuleItem', id));
      });
    });
    return result;
  }
}

export class FromStatement extends ExportableStatement {
  path: ModulePath;
  importList: ImportModuleItems;

  constructor(path: ModulePath, importList: ImportModuleItems) {
    super();
    this.path = path;
    this.importList = importList;
  }

  getModuleItems(): ExportModuleItems {
    return this.importList.map(
      moduleItem => node('exportModuleItem', moduleItem.id),
    );
  }
}

export class ImportStatement extends ExportableStatement {
  modules: ModuleSpecifiers;

  constructor(modules: ModuleSpecifiers) {
    super();
    this.modules = modules;
  }

  getModuleItems(): ExportModuleItems {
    return this.modules.map(
      moduleSpecifier => node('exportModuleItem', moduleSpecifier.alias),
    );
  }
}

export class FunctionDeclaration extends ExportableStatement {
  signature: Signature;
  statements: Statements;

  constructor(signature: Signature, statements: Statements) {
    super();
    this.signature = signature;
    this.statements = statements;
  }

  getModuleItems() {
    return [node('exportModuleItem', this.signature.id)];
  }
}

export class ExportStatement extends Statement {
  statement: ExportableStatement;
  exportItems: ExportModuleItems;

  constructor(exportable: ExportableStatement | ExportModuleItems) {
    super();

    if (isArray(exportable)) {
      this.exportItems = exportable;
    } else {
      this.statement = exportable;
      this.exportItems = exportable.getModuleItems();
    }
  }
}

// Symbol Nodes *************************************************************

export class Symbol extends Node {}

export class Identifier extends Symbol {
  value: string;

  constructor(value: string) {
    super();
    this.value = value;
  }
}

export class Wildcard extends Identifier {}
export class Context extends Identifier {}
export class Self extends Identifier {}
export class Global extends Identifier {}

export class Literal extends Symbol {
  value: any;

  constructor(value: any) {
    super();
    this.value = value;
  }
}

export function isLiteral(n: Node) {
  return n instanceof Literal;
}

export class PatternSymbol extends Symbol {}

export class Regex extends PatternSymbol {
  value: RegExp;

  constructor(pattern: string, flags: string) {
    super();
    this.value = new RegExp(pattern, flags);
  }
}

export class CollectionPattern extends PatternSymbol {
  elements: CollectionPatternElements;

  constructor(elements: CollectionPatternElements) {
    super();
    this.elements = elements;
  }
}

export class ObjectPattern extends CollectionPattern {}
export class ArrayPattern extends CollectionPattern {}

export class PatternElement extends PatternSymbol {
  id: Expression;
  value: CollectionPattern | Expression;

  constructor(id: Expression, value: CollectionPattern | Expression) {
    super();
    this.id = id;
    this.value = value;
  }
}

// Supporting Nodes *********************************************************

export class Range extends Node {
  valueId: Identifier;
  nameId: Identifier;
  collection: Expression;
  guard: Expression;

  constructor(valueId: Identifier, nameId: Identifier,
              collection: Expression, guard: Expression) {
    super();
    this.valueId = valueId;
    this.nameId = nameId;
    this.collection = collection;
    this.guard = guard;
  }
}

export class Signature extends Node {
  id: Identifier;
  params: Parameters;
  guard: Expression;

  constructor(id: Identifier, params: Parameters, guard: Expression) {
    super();
    this.id = id;
    this.params = params || [];
    this.guard = guard;
  }
}

export const Cardinality = {
  Required: 0,
  ZeroToMany: 1,
};

export type CardinalityValue = $Values<typeof Cardinality>;

export class Parameter extends Node {
  id: Identifier;
  cardinality: CardinalityValue;

  constructor(id: Identifier, cardinality: CardinalityValue) {
    super();
    this.id = id;
    this.cardinality = cardinality || Cardinality.Required;
  }
}

export class PatternParameter extends Parameter {
  pattern: Pattern;

  constructor(id: Identifier, pattern: Pattern,
              cardinality: CardinalityValue) {
    super(id, cardinality);
    this.pattern = pattern;
  }
}

export class ImportModuleItem extends Node {
  moduleKey: Literal;
  id: Identifier;

  constructor(moduleKey: Literal, id: Identifier) {
    super();
    this.moduleKey = moduleKey;
    this.id = id;
  }
}

export class ExportModuleItem extends Node {
  id: Identifier;
  moduleKey: Literal;

  constructor(id: Identifier, moduleKey: Literal) {
    super();
    this.id = id;
    this.moduleKey = moduleKey || id.template('literal', id.value);
  }
}

export class ModuleSpecifier extends Node {
  path: ModulePath;
  alias: Identifier;

  constructor(path: ModulePath, alias: Identifier) {
    super();
    this.path = path;
    this.alias = alias || node('id', path.value.split('/').pop());
  }
}

export class ModulePath extends Identifier {}

export class Assignment extends Node {
  value: Expression;

  constructor(value: Expression) {
    super();
    this.value = value;
  }

  // eslint-disable-next-line class-methods-use-this
  getIdentifiers(): Identifiers {
    throw new Error('Stupid Coder: Assignment is abstract');
  }
}

export class DirectAssignment extends Assignment {
  id: Identifier;

  constructor(id: Identifier, value: Expression) {
    super(value);
    this.id = id;
  }

  getIdentifiers() {
    return [this.id];
  }
}

export class ArrayDestructure extends Assignment {
  ids: Identifiers;

  constructor(ids: Identifiers, value: Expression) {
    super(value);
    this.ids = ids;
  }

  getIdentifiers() {
    return this.ids;
  }
}

export class ObjectDestructure extends Assignment {
  items: ObjectDestructureItem[];

  constructor(items: ObjectDestructureItem[], value: Expression) {
    super(value);
    this.items = items;
  }

  getIdentifiers(): Identifiers {
    return this.items.map(item => item.id);
  }
}

export class ObjectDestructureItem extends Node {
  id: Identifier;
  value: Expression;

  constructor(id: Identifier, value: Expression) {
    super();
    this.id = id;
    this.value = value;
  }
}

export class ObjectAssignment extends Node {
  id: Expression;
  value: Expression;

  constructor(id: Expression, value: Expression) {
    super();
    this.id = id;
    this.value = value;
  }
}

export class Select extends Node {
  value: Expression;
  name: ?Expression;

  constructor(value: Expression, name?: Expression) {
    super();
    this.value = value;
    this.name = name;
  }
}
