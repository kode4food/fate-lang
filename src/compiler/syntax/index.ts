"use strict";

export * from './Annotation';
export * from './Tree';
export * from './Visitor';

import * as Tree from './Tree';

type FunctionMap = { [index: string]: Function };

export type Tag = string;
export type Tags = Tag[];
export type TagOrTags = Tag|Tags;

let tagToConstructor: FunctionMap = {
  'from': Tree.FromStatement,
  'import': Tree.ImportStatement,
  'export': Tree.ExportStatement,
  'function': Tree.FunctionDeclaration,
  'lambda': Tree.LambdaExpression,
  'compose': Tree.ComposeExpression,
  'composeOr': Tree.ComposeExpression,
  'composeAnd': Tree.ComposeExpression,
  'reduce': Tree.ReduceExpression,
  'do': Tree.DoExpression,
  'case': Tree.CaseExpression,
  'match': Tree.MatchExpression,
  'matchClause': Tree.MatchClause,
  'call': Tree.CallOperator,
  'bind': Tree.BindOperator,
  'let': Tree.LetStatement,
  'return': Tree.ReturnStatement,
  'expression': Tree.ExpressionStatement,
  'arrayComp': Tree.ArrayComprehension,
  'objectComp': Tree.ObjectComprehension,
  'for': Tree.ForStatement,
  'conditional': Tree.ConditionalOperator,
  'if': Tree.IfStatement,
  'ifLet': Tree.IfLetStatement,
  'or': Tree.OrOperator,
  'and': Tree.AndOperator,
  'like': Tree.LikeOperator,
  'notLike': Tree.NotLikeOperator,
  'eq': Tree.EqualOperator,
  'neq': Tree.NotEqualOperator,
  'in': Tree.InOperator,
  'notIn': Tree.NotInOperator,
  'gt': Tree.GreaterOperator,
  'lt': Tree.LessThanOperator,
  'gte': Tree.GreaterOrEqualOperator,
  'lte': Tree.LessOrEqualOperator,
  'add': Tree.AddOperator,
  'sub': Tree.SubtractOperator,
  'mul': Tree.MultiplyOperator,
  'div': Tree.DivideOperator,
  'mod': Tree.ModuloOperator,
  'not': Tree.NotOperator,
  'neg': Tree.NegativeOperator,
  'pos': Tree.PositiveOperator,
  'await': Tree.AwaitOperator,
  'parens': Tree.Parens,
  'format': Tree.FormatOperator,
  'member': Tree.MemberOperator,
  'array': Tree.ArrayConstructor,
  'object': Tree.ObjectConstructor,
  'id': Tree.Identifier,
  'context': Tree.Context,
  'self': Tree.Self,
  'global': Tree.Global,
  'literal': Tree.Literal,
  'pattern': Tree.Pattern,
  'regex': Tree.Regex,
  'objectPattern': Tree.ObjectPattern,
  'arrayPattern': Tree.ArrayPattern,
  'patternElement': Tree.PatternElement,
  'wildcard': Tree.Wildcard,
  'statements': Tree.Statements,
  'range': Tree.Range,
  'signature': Tree.Signature,
  'idParam': Tree.Parameter,
  'patternParam': Tree.PatternParameter,
  'importModuleItem': Tree.ImportModuleItem,
  'exportModuleItem': Tree.ExportModuleItem,
  'moduleSpecifier': Tree.ModuleSpecifier,
  'modulePath': Tree.ModulePath,
  'assignment': Tree.DirectAssignment,
  'arrayDestructure': Tree.ArrayDestructure,
  'objectDestructure': Tree.ObjectDestructure,
  'objectDestructureItem': Tree.ObjectDestructureItem,
  'objectAssignment': Tree.ObjectAssignment
};

export function node(tag: Tag, ...args: any[]) {
  let constructor = tagToConstructor[tag];
  let instance = Object.create(constructor.prototype);
  instance.tag = tag;
  constructor.apply(instance, args);
  return instance;
}
