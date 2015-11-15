/// <reference path="../Types.ts"/>
/// <reference path="./Annotations.ts"/>
/// <reference path="./Syntax.ts"/>
/// <reference path="./Visitor.ts"/>

"use strict";

namespace Fate.Compiler.Rewriter {
  import isTrue = Types.isTrue;
  import isFalse = Types.isFalse;
  import isIn = Types.isIn;

  import Syntax = Compiler.Syntax;
  import hasTag = Syntax.hasTag;
  import isStatements = Syntax.isStatements;
  import isLiteral = Syntax.isLiteral;
  import annotate = Compiler.annotate;

  type LiteralArray = any[];
  type StringMap = { [index: string]: string };
  type LiteralObject = { [index: string]: any };
  type FunctionMap = { [index: string]: Function };

  var inverseOperators: StringMap = {
    'eq': 'neq', 'neq': 'eq',
    'lt': 'gte', 'gte': 'lt',
    'gt': 'lte', 'lte': 'gt'
  };

  var constantFolders: FunctionMap = {
    'not':   function (v: any) { return isFalse(v); },
    'neg':   function (v: any) { return -v; },
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
  var constantFolderKeys = Object.keys(constantFolders);

  var shortCircuitFolders: FunctionMap = {
    'or': function (node: Syntax.OrOperator) {
      if ( !isLiteral(node.left) ) {
        return node;
      }
      var value = (<Syntax.Literal>node.left).value;
      return isTrue(value) ? node.left : node.right;
    },
    'and': function (node: Syntax.AndOperator) {
      if ( !isLiteral(node.left) ) {
        return node;
      }
      var value = (<Syntax.Literal>node.left).value;
      return isFalse(value) ? node.left : node.right;
    },
    'conditional': function (node: Syntax.ConditionalOperator) {
      if ( !isLiteral(node.condition) ) {
        return node;
      }
      var value = (<Syntax.Literal>node.condition).value;
      return isTrue(value) ? node.trueResult : node.falseResult;
    }
  };
  var shortCircuitFolderKeys = Object.keys(shortCircuitFolders);

  export function createTreeProcessors(visit: Compiler.Visitor) {
    var foldableShortCircuit = visit.tags(shortCircuitFolderKeys);
    var foldableConstant = visit.tags(constantFolderKeys);
    var collection = visit.tags(['object', 'array']);

    return [
      visit.matching(foldShortCircuits, foldableShortCircuit),
      visit.matching(foldConstants, foldableConstant),

      visit.matching(rollUpObjectsAndArrays, collection),

      visit.statements(foldIfStatements),
      visit.matching(flipConditionals, visit.tags('conditional')),
      visit.matching(flipEquality, visit.tags('not')),
      visit.matching(promoteNot, visit.tags(['and', 'or'])),
      visit.matching(rollUpForLoops, visit.tags('for')),

      visit.statementGroups(mergeFunctions, visit.tags('function'))
    ];

    // Or, And, Conditional Folding
    function foldShortCircuits(node: Syntax.Node) {
      var tag = hasTag(node);
      return shortCircuitFolders[tag](node);
    }

    // Simple constant folding
    function foldConstants(node: Syntax.UnaryOperator|Syntax.BinaryOperator) {
      if ( !isLiteral(node.left) ) {
        return node;
      }
      var leftValue = (<Syntax.Literal>node.left).value;

      if ( !(node instanceof Syntax.BinaryOperator) ||
           !isLiteral(node.right) ) {
        return node;
      }

      var tag = hasTag(node);
      var rightNode = (<Syntax.BinaryOperator>node).right;
      var rightValue = (<Syntax.Literal>rightNode).value;
      var output = constantFolders[tag](leftValue, rightValue);
      return node.template('literal', output);
    }

    // If all the elements of an Array or Array are literals, then we can
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
      var elements = node.elements;
      var output: LiteralArray = [];
      var type = 'literal';

      for ( var i = 0, len = elements.length; i < len; i++ ) {
        var element = elements[i];
        if ( !isLiteral(element) ) {
          return node;
        }
        output.push((<Syntax.Literal>element).value);
      }

      return node.template(type, output);
    }

    function rollUpObject(node: Syntax.ObjectConstructor) {
      var elements = node.elements;
      var output: LiteralObject = {};
      var type = 'literal';

      for ( var i = 0, len = elements.length; i < len; i++ ) {
        var element = elements[i];
        var name = element.id;
        var value = element.value;
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
      var output: Syntax.Statement[] = [];
      statements.forEach(function (statement) {
        if ( !hasTag(statement, 'if') || !isLiteral(statement.condition ) ) {
          output.push(statement);
          return;
        }

        var foldedStatements: Syntax.Statement[];
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

    // If the condition is 'not' we can roll up its argument
    // and flip the branches.
    function flipConditionals(node: Syntax.ConditionalOperator) {
      if ( !hasTag(node.condition, 'not') ) {
        return node;
      }

      var cond = (<Syntax.NotOperator>node.condition).left;
      return node.template(node, cond, node.falseResult, node.trueResult);
    }

    // if the operator is 'not' and it contains an equality,
    // then we can flip the equality operator and roll it up
    function flipEquality(node: Syntax.NotOperator) {
      var tag = hasTag(node.left);
      var newTag = inverseOperators[tag];

      if ( !tag || !newTag ) {
        return node;
      }

      var child = <Syntax.BinaryOperator>node.left;
      return node.template(newTag, child.left, child.right);
    }

    // If left and right operands of an 'and' or 'or' are using the 'not'
    // unary, then promote it to the top and flip the and/or
    function promoteNot(node: Syntax.BinaryOperator) {
      var leftTag = hasTag(node.left, 'not');
      var rightTag = hasTag(node.right, 'not');

      if ( !leftTag || !rightTag ) {
        return node;
      }

      var left = <Syntax.NotOperator>node.left;
      var right = <Syntax.NotOperator>node.right;

      var tag = hasTag(node);
      var newTag = tag === 'and' ? 'or' : 'and';

      var newNode = node.template(newTag, left.left, right.left);
      return left.template('not', newNode);
    }

    // We can roll up a single nested for loop into a containing for
    // loop so that they share the same context
    function rollUpForLoops(node: Syntax.ForStatement) {
      var forStatements = node.loopStatements.statements;

      if ( forStatements.length !== 1 ) {
        return node;  // should only be one child
      }
      if ( !hasTag(forStatements[0], 'for') ) {
        return node;  // should have a nested for loop
      }

      var nested = <Syntax.ForStatement>forStatements[0];
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

    // We can merge consecutive non-recursive functions that are
    // argument compatible and don't recurse
    function mergeFunctions(statements: Syntax.FunctionDeclaration[]) {
      var group: Syntax.FunctionDeclaration[] = [];
      var result: Syntax.Statement[] = [];
      var lastName: string;

      statements.forEach(function (statement) {
        var signature = statement.signature;
        var name = signature.id.value;

        if ( name !== lastName ||
             hasAnnotation(statement, 'function/no_merge') ) {
          processGroup();
        }

        if ( !signature.guard && group.length ) {
          // if we see an unguarded, we can blow away the previous funcs
          group = [];
        }

        lastName = name;
        group.push(statement);
      });
      processGroup();

      return result;

      function processGroup() {
        if ( group.length < 2 ) {
          result = result.concat(group);
          group = [];
          return;
        }

        var firstDefinition = group[0];
        var firstSignature = firstDefinition.signature;
        var firstStatements = firstDefinition.statements;
        var statements = firstStatements.statements.slice();
        var guard = firstSignature.guard;

        if ( guard ) {
          statements = [
            guard.template('if',
              guard, firstStatements,
              firstStatements.template('statements', [])
            )
          ];
        }

        var prevStatements = firstStatements;
        for ( var i = 1, len = group.length; i < len; i++ ) {
          var definition = group[i];
          var signature = definition.signature;
          var theseStatements = definition.statements;
          var thisGuard = signature.guard;

          statements = [
            thisGuard.template('if', thisGuard, theseStatements,
              prevStatements.template('statements', statements)
            )
          ];
          guard = guard && guard.template('or', thisGuard, guard);
          prevStatements = theseStatements;
        }

        result.push(
          firstDefinition.template('function',
            firstSignature.template('signature',
              firstSignature.id, firstSignature.params, guard
            ),
            firstStatements.template('statements', statements)
          )
        );

        group = [];
      }
    }
  }
}
