"use strict";

import Visitor from './Visitor';
import * as Syntax from './Syntax';
import { isTrue, isFalse, isIn } from '../Types';
import { annotate, hasAnnotation } from './Annotations';

let hasTag = Syntax.hasTag;
let isLiteral = Syntax.isLiteral;

type LiteralArray = any[];
type StringMap = { [index: string]: string };
type LiteralObject = { [index: string]: any };
type FunctionMap = { [index: string]: Function };

let inverseOperators: StringMap = {
  'eq': 'neq', 'neq': 'eq',
  'lt': 'gte', 'gte': 'lt',
  'gt': 'lte', 'lte': 'gt'
};

let unaryConstantFolders: FunctionMap = {
  'not':   function (v: any) { return isFalse(v); },
  'neg':   function (v: any) { return -v; }
};
let unaryConstantFolderKeys = Object.keys(unaryConstantFolders);

let binaryConstantFolders: FunctionMap = {
  'add':   function (l: any, r: any) { return l + r; },
  'sub':   function (l: any, r: any) { return l - r; },
  'mul':   function (l: any, r: any) { return l * r; },
  'div':   function (l: any, r: any) { return l / r; },
  'eq':    function (l: any, r: any) { return l === r; },
  'neq':   function (l: any, r: any) { return l !== r; },
  'in':    function (l: any, r: any) { return isIn(l, r); },
  'notIn': function (l: any, r: any) { return !isIn(l, r); },
  'gt':    function (l: any, r: any) { return l > r; },
  'lt':    function (l: any, r: any) { return l < r; },
  'gte':   function (l: any, r: any) { return l >= r; },
  'lte':   function (l: any, r: any) { return l <= r; },
  'mod':   function (l: any, r: any) { return l % r; }
};
let binaryConstantFolderKeys = Object.keys(binaryConstantFolders);

let shortCircuitFolders: FunctionMap = {
  'or': function (node: Syntax.OrOperator) {
    if ( !isLiteral(node.left) ) {
      return node;
    }
    let value = (<Syntax.Literal>node.left).value;
    return isTrue(value) ? node.left : node.right;
  },
  'and': function (node: Syntax.AndOperator) {
    if ( !isLiteral(node.left) ) {
      return node;
    }
    let value = (<Syntax.Literal>node.left).value;
    return isFalse(value) ? node.left : node.right;
  },
  'conditional': function (node: Syntax.ConditionalOperator) {
    if ( !isLiteral(node.condition) ) {
      return node;
    }
    let value = (<Syntax.Literal>node.condition).value;
    return isTrue(value) ? node.trueResult : node.falseResult;
  }
};
let shortCircuitFolderKeys = Object.keys(shortCircuitFolders);

export default function createTreeProcessors(visit: Visitor) {
  let foldableShortCircuit = visit.tags(shortCircuitFolderKeys);
  let foldableUnaryConstant = visit.tags(unaryConstantFolderKeys);
  let foldableBinaryConstant = visit.tags(binaryConstantFolderKeys);
  let collection = visit.tags(['object', 'array']);

  return [
    visit.matching(buildPatternGuards, visit.tags('signature')),
    visit.matching(expandCaseExpressions, visit.tags('case')),

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

  function buildPatternGuards(node: Syntax.Signature) {
    let newGuards: Syntax.Expressions = [];

    // Generate Guards from the Parameters
    let params = node.params;
    params.forEach((param, idx) => {
      if ( param instanceof Syntax.PatternParameter ) {
        let ident = param.id || param.template('id', idx);
        params[idx] = ident.template('idParam', ident, param.cardinality);
        newGuards.push(ident.template('like', ident, param.pattern));
      }
    });

    // Combine the Guards
    if ( newGuards.length ) {
      if ( node.guard ) {
        // Push it to the end of the list
        newGuards.push(node.guard);
      }
      node.guard = newGuards.shift();
      newGuards.forEach((newGuard) => {
        node.guard = node.guard.template('and', node.guard, newGuard);
      });
    }

    return node;
  }

  function expandCaseExpressions(node: Syntax.CaseExpression) {
    return node.template('do',
      node.template('statements', [
        node.template('expression',
          node.template('await',
            node.template('array', node.whenClauses),
            'any'
          )
        )
      ])
    );
  }

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
    if ( hasAnnotation(node, 'pattern/node') ) {
      return node;
    }
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
    statements.forEach(function (statement) {
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
    statements.forEach(function (statement) {
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
