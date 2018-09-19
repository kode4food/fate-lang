/** @flow */

import * as Syntax from '../syntax';
import { isTrue, isFalse, isIn } from '../../runtime';

const {
  Visitor, annotate, hasTag, isLiteral,
} = Syntax;

const inverseOperators = {
  eq: 'neq',
  neq: 'eq',
  lt: 'gte',
  gte: 'lt',
  gt: 'lte',
  lte: 'gt',
};

const unaryConstantFolders = {
  not: (v: any) => isFalse(v),
  neg: (v: any) => -v,
};

const unaryConstantFolderKeys = Object.keys(unaryConstantFolders);

const binaryConstantFolders = {
  add: (l: any, r: any) => l + r,
  sub: (l: any, r: any) => l - r,
  mul: (l: any, r: any) => l * r,
  div: (l: any, r: any) => l / r,
  eq: (l: any, r: any) => l === r,
  neq: (l: any, r: any) => l !== r,
  in: (l: any, r: any) => isIn(l, r),
  notIn: (l: any, r: any) => !isIn(l, r),
  gt: (l: any, r: any) => l > r,
  lt: (l: any, r: any) => l < r,
  gte: (l: any, r: any) => l >= r,
  lte: (l: any, r: any) => l <= r,
  mod: (l: any, r: any) => l % r,
};

const binaryConstantFolderKeys = Object.keys(binaryConstantFolders);

const shortCircuitFolders = {
  or: (node: Syntax.OrOperator) => {
    if (!isLiteral(node.left)) {
      return node;
    }
    const { value } = node.left;
    return isTrue(value) ? node.left : node.right;
  },
  and: (node: Syntax.AndOperator) => {
    if (!isLiteral(node.left)) {
      return node;
    }
    const { value } = node.left;
    return isFalse(value) ? node.left : node.right;
  },
  conditional: (node: Syntax.ConditionalOperator) => {
    if (!isLiteral(node.condition)) {
      return node;
    }
    const { value } = node.condition;
    return isTrue(value) ? node.trueResult : node.falseResult;
  },
};

const shortCircuitFolderKeys = Object.keys(shortCircuitFolders);

export default function createTreeProcessors(visit: Visitor) {
  const foldableShortCircuit = visit.tags(shortCircuitFolderKeys);
  const foldableUnaryConstant = visit.tags(unaryConstantFolderKeys);
  const foldableBinaryConstant = visit.tags(binaryConstantFolderKeys);
  const collection = visit.tags(['object', 'array']);

  return [
    visit.matching(foldShortCircuits, foldableShortCircuit),
    visit.matching(foldUnaryConstants, foldableUnaryConstant),
    visit.matching(foldBinaryConstants, foldableBinaryConstant),
    visit.matching(rollUpObjectsAndArrays, collection),

    visit.statements(foldIfStatements),

    visit.byTag({
      conditional: flipConditionals,
      not: flipEquality,
      and: promoteNot,
      or: promoteNot,
      for: rollUpForLoops,
      expression: rollUpStandaloneLoops,
    }),

    visit.statementGroups(splitExportStatements, visit.tags('export'), 1),
  ];

  // or, and, conditional Folding
  function foldShortCircuits(node: Syntax.Node) {
    const tag = hasTag(node);
    return shortCircuitFolders[tag](node);
  }

  function foldUnaryConstants(node: Syntax.UnaryOperator) {
    if (!isLiteral(node.left)) {
      return node;
    }

    const tag = hasTag(node);
    const leftValue = node.left.value;
    const output = unaryConstantFolders[tag](leftValue);
    return node.template('literal', output);
  }

  function foldBinaryConstants(node: Syntax.BinaryOperator) {
    if (!isLiteral(node.left) || !isLiteral(node.right)) {
      return node;
    }

    const tag = hasTag(node);
    const leftValue = node.left.value;
    const rightValue = node.right.value;
    const output = binaryConstantFolders[tag](leftValue, rightValue);
    return node.template('literal', output);
  }

  // if all the elements of an Array or Array are literals, then we can
  // convert it to a literal
  function rollUpObjectsAndArrays(node: Syntax.ElementsConstructor) {
    if (node.tag === 'array') {
      return rollUpArray(node);
    }
    return rollUpObject(node);
  }

  function rollUpArray(node: Syntax.ArrayConstructor) {
    const { elements } = node;
    const output = [];
    const type = 'literal';

    for (let i = 0, len = elements.length; i < len; i += 1) {
      const element = elements[i];
      if (!isLiteral(element)) {
        return node;
      }
      output.push(element.value);
    }

    return node.template(type, output);
  }

  function rollUpObject(node: Syntax.ObjectConstructor) {
    const { elements } = node;
    const output = {};
    const type = 'literal';

    for (let i = 0, len = elements.length; i < len; i += 1) {
      const element = elements[i];
      const name = element.id;
      const { value } = element;
      if (!isLiteral(name) || !isLiteral(value)) {
        return node;
      }
      output[name.value] = value.value;
    }

    return node.template(type, output);
  }

  // if an 'if' statement is evaluating a constant, then we can eliminate
  // the inapplicable branch and just inline the matching statements
  function foldIfStatements(statements: Syntax.IfStatement[]) {
    let output: Syntax.Statement[] = [];
    statements.forEach((statement) => {
      if (!hasTag(statement, 'if') || !isLiteral(statement.condition)) {
        output.push(statement);
        return;
      }

      let foldedStatements: Syntax.Statement[];
      if (isTrue(statement.condition.value)) {
        foldedStatements = statement.thenStatements.statements;
      } else {
        foldedStatements = statement.elseStatements.statements;
      }
      output = output.concat(foldedStatements);
    });
    return output;
  }

  // if the condition is 'not' we can roll up its argument
  // and flip the branches.
  function flipConditionals(node: Syntax.ConditionalOperator) {
    if (!hasTag(node.condition, 'not')) {
      return node;
    }

    const cond = node.condition.left;
    return node.template(node.tag, cond, node.falseResult, node.trueResult);
  }

  // if the operator is 'not' and it contains an equality,
  // then we can flip the equality operator and roll it up
  function flipEquality(node: Syntax.NotOperator) {
    const tag = hasTag(node.left);
    const newTag = inverseOperators[tag];

    if (!tag || !newTag) {
      return node;
    }

    const child = node.left;
    return node.template(newTag, child.left, child.right);
  }

  // if left and right operands of an 'and' or 'or' are using the 'not'
  // unary, then promote it to the top and flip the and/or
  function promoteNot(node: Syntax.BinaryOperator) {
    const leftTag = hasTag(node.left, 'not');
    const rightTag = hasTag(node.right, 'not');

    if (!leftTag || !rightTag) {
      return node;
    }

    const { left, right } = node;
    const tag = hasTag(node);
    const newTag = tag === 'and' ? 'or' : 'and';

    const newNode = node.template(newTag, left.left, right.left);
    return left.template('not', newNode);
  }

  // we can roll up a single nested for loop into a containing for
  // loop so that they share the same context
  function rollUpForLoops(node: Syntax.ForStatement) {
    const forStatements = node.loopStatements.statements;

    if (forStatements.length !== 1) {
      return node; // should only be one child
    }
    if (!hasTag(forStatements[0], 'for')) {
      return node; // should have a nested for loop
    }

    const nested = forStatements[0];
    if (!node.elseStatements.isEmpty()
      || !nested.elseStatements.isEmpty()) {
      return node; // no else clauses
    }

    return node.template(
      'for',
      node.ranges.concat(nested.ranges),
      nested.loopStatements,
      node.elseStatements,
    );
  }

  function rollUpStandaloneLoops(statement: Syntax.ExpressionStatement) {
    if (Syntax.hasTag(statement.expression, 'reduce')) {
      annotate(statement.expression, 'function/single_expression');
      return statement.expression;
    }
    return statement;
  }

  function splitExportStatements(statements: Syntax.ExportStatement[]) {
    const result: Syntax.Statement[] = [];
    statements.forEach((statement) => {
      const exportedStatement = statement.statement;
      if (exportedStatement) {
        result.push(exportedStatement);
        // eslint-disable-next-line no-param-reassign
        statement.statement = null;
      }
      result.push(statement);
    });
    return result;
  }
}
