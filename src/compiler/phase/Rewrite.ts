"use strict";

import * as Syntax from '../syntax';
import { Visitor, annotate } from '../syntax';
import { isTrue, isFalse, isIn } from '../../runtime';

const hasTag = Syntax.hasTag;
const isLiteral = Syntax.isLiteral;

type LiteralArray = any[];
type StringMap = { [index: string]: string };
type LiteralObject = { [index: string]: any };
type FunctionMap = { [index: string]: Function };

const inverseOperators: StringMap = {
  'eq': 'neq', 'neq': 'eq',
  'lt': 'gte', 'gte': 'lt',
  'gt': 'lte', 'lte': 'gt'
};

const unaryConstantFolders: FunctionMap = {
  'not':   (v: any) => isFalse(v),
  'neg':   (v: any) => -v
};

const unaryConstantFolderKeys = Object.keys(unaryConstantFolders);

const binaryConstantFolders: FunctionMap = {
  'add':   (l: any, r: any) => l + r,
  'sub':   (l: any, r: any) => l - r,
  'mul':   (l: any, r: any) => l * r,
  'div':   (l: any, r: any) => l / r,
  'eq':    (l: any, r: any) => l === r,
  'neq':   (l: any, r: any) => l !== r,
  'in':    (l: any, r: any) => isIn(l, r),
  'notIn': (l: any, r: any) => !isIn(l, r),
  'gt':    (l: any, r: any) => l > r,
  'lt':    (l: any, r: any) => l < r,
  'gte':   (l: any, r: any) => l >= r,
  'lte':   (l: any, r: any) => l <= r,
  'mod':   (l: any, r: any) => l % r
};

const binaryConstantFolderKeys = Object.keys(binaryConstantFolders);

const shortCircuitFolders: FunctionMap = {
  'or': (node: Syntax.OrOperator) => {
    if ( !isLiteral(node.left) ) {
      return node;
    }
    let value = (<Syntax.Literal>node.left).value;
    return isTrue(value) ? node.left : node.right;
  },
  'and': (node: Syntax.AndOperator) => {
    if ( !isLiteral(node.left) ) {
      return node;
    }
    let value = (<Syntax.Literal>node.left).value;
    return isFalse(value) ? node.left : node.right;
  },
  'conditional': (node: Syntax.ConditionalOperator) => {
    if ( !isLiteral(node.condition) ) {
      return node;
    }
    let value = (<Syntax.Literal>node.condition).value;
    return isTrue(value) ? node.trueResult : node.falseResult;
  }
};

const shortCircuitFolderKeys = Object.keys(shortCircuitFolders);

export default function createTreeProcessors(visit: Visitor) {
  let foldableShortCircuit = visit.tags(shortCircuitFolderKeys);
  let foldableUnaryConstant = visit.tags(unaryConstantFolderKeys);
  let foldableBinaryConstant = visit.tags(binaryConstantFolderKeys);
  let collection = visit.tags(['object', 'array']);

  return [
    visit.matching(foldShortCircuits, foldableShortCircuit),
    visit.matching(foldUnaryConstants, foldableUnaryConstant),
    visit.matching(foldBinaryConstants, foldableBinaryConstant),

    visit.matching(rollUpObjectsAndArrays, collection),

    visit.statements(foldIfStatements),
    visit.matching(flipConditionals, visit.tags('conditional')),
    visit.matching(flipEquality, visit.tags('not')),
    visit.matching(promoteNot, visit.tags(['and', 'or'])),
    visit.matching(rollUpForLoops, visit.tags('for')),
    visit.matching(rollUpStandaloneLoops, visit.tags('expression')),

    visit.statementGroups(splitExportStatements, visit.tags('export'), 1)
  ];


  // or, and, conditional Folding
  function foldShortCircuits(node: Syntax.Node) {
    let tag = hasTag(node);
    return shortCircuitFolders[tag](node);
  }

  function foldUnaryConstants(node: Syntax.UnaryOperator) {
    if ( !isLiteral(node.left) ) {
      return node;
    }

    let tag = hasTag(node);
    let leftValue = (<Syntax.Literal>node.left).value;
    let output = unaryConstantFolders[tag](leftValue);
    return node.template('literal', output);
  }

  function foldBinaryConstants(node: Syntax.BinaryOperator) {
    if ( !isLiteral(node.left) || !isLiteral(node.right) ) {
      return node;
    }

    let tag = hasTag(node);
    let leftValue = (<Syntax.Literal>node.left).value;
    let rightValue = (<Syntax.Literal>node.right).value;
    let output = binaryConstantFolders[tag](leftValue, rightValue);
    return node.template('literal', output);
  }

  // if all the elements of an Array or Array are literals, then we can
  // convert it to a literal
  function rollUpObjectsAndArrays(node: Syntax.ElementsConstructor) {
    if ( node.tag === 'array' ) {
      return rollUpArray(<Syntax.ArrayConstructor>node);
    }
    return rollUpObject(<Syntax.ObjectConstructor>node);
  }

  function rollUpArray(node: Syntax.ArrayConstructor) {
    let elements = node.elements;
    let output: LiteralArray = [];
    let type = 'literal';

    for ( let i = 0, len = elements.length; i < len; i++ ) {
      let element = elements[i];
      if ( !isLiteral(element) ) {
        return node;
      }
      output.push((<Syntax.Literal>element).value);
    }

    return node.template(type, output);
  }

  function rollUpObject(node: Syntax.ObjectConstructor) {
    let elements = node.elements;
    let output: LiteralObject = {};
    let type = 'literal';

    for ( let i = 0, len = elements.length; i < len; i++ ) {
      let element = elements[i];
      let name = element.id;
      let value = element.value;
      if ( !isLiteral(name) || !isLiteral(value) ) {
        return node;
      }
      output[(<Syntax.Literal>name).value] = (<Syntax.Literal>value).value;
    }

    return node.template(type, output);
  }

  // if an 'if' statement is evaluating a constant, then we can eliminate
  // the inapplicable branch and just inline the matching statements
  function foldIfStatements(statements: Syntax.IfStatement[]) {
    let output: Syntax.Statement[] = [];
    statements.forEach(statement => {
      if ( !hasTag(statement, 'if') || !isLiteral(statement.condition) ) {
        output.push(statement);
        return;
      }

      let foldedStatements: Syntax.Statement[];
      if ( isTrue((<Syntax.Literal>statement.condition).value) ) {
        foldedStatements = statement.thenStatements.statements;
      }
      else {
        foldedStatements = statement.elseStatements.statements;
      }
      output = output.concat(foldedStatements);
    });
    return output;
  }

  // if the condition is 'not' we can roll up its argument
  // and flip the branches.
  function flipConditionals(node: Syntax.ConditionalOperator) {
    if ( !hasTag(node.condition, 'not') ) {
      return node;
    }

    let cond = (<Syntax.NotOperator>node.condition).left;
    return node.template(node.tag, cond, node.falseResult, node.trueResult);
  }

  // if the operator is 'not' and it contains an equality,
  // then we can flip the equality operator and roll it up
  function flipEquality(node: Syntax.NotOperator) {
    let tag = hasTag(node.left);
    let newTag = inverseOperators[tag];

    if ( !tag || !newTag ) {
      return node;
    }

    let child = <Syntax.BinaryOperator>node.left;
    return node.template(newTag, child.left, child.right);
  }

  // if left and right operands of an 'and' or 'or' are using the 'not'
  // unary, then promote it to the top and flip the and/or
  function promoteNot(node: Syntax.BinaryOperator) {
    let leftTag = hasTag(node.left, 'not');
    let rightTag = hasTag(node.right, 'not');

    if ( !leftTag || !rightTag ) {
      return node;
    }

    let left = <Syntax.NotOperator>node.left;
    let right = <Syntax.NotOperator>node.right;

    let tag = hasTag(node);
    let newTag = tag === 'and' ? 'or' : 'and';

    let newNode = node.template(newTag, left.left, right.left);
    return left.template('not', newNode);
  }

  // we can roll up a single nested for loop into a containing for
  // loop so that they share the same context
  function rollUpForLoops(node: Syntax.ForStatement) {
    let forStatements = node.loopStatements.statements;

    if ( forStatements.length !== 1 ) {
      return node;  // should only be one child
    }
    if ( !hasTag(forStatements[0], 'for') ) {
      return node;  // should have a nested for loop
    }

    let nested = <Syntax.ForStatement>forStatements[0];
    if ( !node.elseStatements.isEmpty() ||
         !nested.elseStatements.isEmpty() ) {
      return node;  // no else clauses
    }

    return node.template('for',
      node.ranges.concat(nested.ranges),
      nested.loopStatements,
      node.elseStatements
    );
  }

  function rollUpStandaloneLoops(statement: Syntax.ExpressionStatement) {
    if ( Syntax.hasTag(statement.expression,
                       ['arrayComp', 'objectComp', 'reduce']) ) {
      annotate(statement.expression, 'function/single_expression');
      return statement.expression;
    }
    return statement;
  }

  function splitExportStatements(statements: Syntax.ExportStatement[]) {
    let result: Syntax.Statement[] = [];
    statements.forEach(statement => {
      let exportedStatement = statement.statement;
      if ( exportedStatement ) {
        result.push(exportedStatement);
        statement.statement = null;
      }
      result.push(statement);
    });
    return result;
  }
}
