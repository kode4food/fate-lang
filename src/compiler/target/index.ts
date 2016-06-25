"use strict";

import * as Syntax from '../syntax';
import * as JavaScript from './JavaScript';

import { DispatchEvaluator } from '../evaluator';
import { StatementsEvaluator } from '../evaluator/BasicEvaluator';

export type Id = string;
export type Ids = Id[];

export type Name = string;
export type Names = Name[];
export type Alias = Name;

export type AssignmentItem = [Name, BodyEntry];
export type AssignmentItems = AssignmentItem[];
export type ModuleItem = [Name, Alias];
export type ModuleItems = ModuleItem[];
export type ObjectAssignmentItem = [Name|BodyEntry, BodyEntry, boolean];
export type ObjectAssignmentItems = ObjectAssignmentItem[];

export type BodyEntry = string|Function;
export type BodyEntries = BodyEntry[];
export type Literal = string|Id;

export type GeneratedCode = string;

export interface LoopOptions {
  name?: Name;
  value: Name;
  collection: BodyEntry;
  guard: BodyEntry;
  body: BodyEntry;
}

export interface FunctionOptions {
  internalId?: string;
  internalArgs?: Name[];
  contextArgs?: Name[];
  generator?: boolean;
  body: BodyEntry;
}

export interface Coder {
  selfName: string;
  contextName: string;
  exportsName: string;
  valueName: string;
  literal(literalValue: any): Literal;
  runtimeImport(funcName: string): Id;
  builder(funcName: string, ...literalIds: Ids): BodyEntry;
  self(): void;
  currentDirectory(): Literal;
  args(startAt: number): void;
  context(): void;
  member(object: BodyEntry, property: BodyEntry): void;
  retrieveAnonymous(name: Name): void;
  assignAnonymous(name: Name, value: BodyEntry): void;
  registerAnonymous(id: string): void;
  createAnonymous(): Name;
  assignResult(value: BodyEntry): void;
  write(...content: any[]): void;
  writeAndGroup(items: BodyEntries): void;
  getter(name: Name): void;
  assignment(name: Name, bodyEntry: BodyEntry): void;
  assignments(items: AssignmentItems): void;
  exports(items: ModuleItems): void;
  unaryOperator(operator: string, operand: BodyEntry): void;
  binaryOperator(operator: string, left: BodyEntry, right: BodyEntry): void;
  conditionalOperator(condition: BodyEntry, trueVal: BodyEntry,
                                falseVal: BodyEntry): void;
  statement(bodyCallback: BodyEntry): void;
  ifStatement(condition: BodyEntry, thenBranch: BodyEntry,
                       elseBranch: BodyEntry): void;
  loopExpression(options: LoopOptions): void;
  loopContinue(): void;
  funcDeclaration(name: Name, options: FunctionOptions): void;
  iife(funcBody: BodyEntry): void;
  scope(scopeBody: BodyEntry): void;
  func(options: FunctionOptions): void;
  waitFor(resolver: Syntax.Resolver, expression: BodyEntry): void;
  compoundExpression(expressions: BodyEntries): void;
  returnStatement(bodyCallback?: Function): void;
  call(funcId: Id|BodyEntry, args?: BodyEntries): void;
  array(items: BodyEntries): void;
  arrayAppend(array: Id, value: BodyEntry): void;
  object(items: ObjectAssignmentItems): void;
  objectAssign(dict: Id, name: BodyEntry, value: BodyEntry): void;
  parens(expr: BodyEntry): void;
  code(value?: BodyEntry|BodyEntries): string;
  toString(): string;
}

/*
 * Converts a parse tree into source code (initially JavaScript). Host
 * Language-specific constructs are avoided here and instead produced
 * by JavaScript code generation module.
 */
export function generateScriptBody(parseTree: Syntax.Statements) {
  // generate the module function and return the source code
  return createScriptFunction(parseTree);
}

function createScriptFunction(statements: Syntax.Statements) {
  let coder = JavaScript.createCoder();

  coder.func({
    internalId: coder.selfName,
    internalArgs: [coder.contextName, coder.exportsName],
    body: () => {
      let dispatcher = new DispatchEvaluator(coder);
      new StatementsEvaluator(dispatcher).evaluate(statements);
    }
  });
  return coder.toString();
}
