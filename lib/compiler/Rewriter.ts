/// <reference path="../Types.ts"/>
/// <reference path="./Annotations.ts"/>
/// <reference path="./Syntax.ts"/>
/// <reference path="./Visitor.ts"/>

"use strict";

namespace Fate.Compiler.Rewriter {
  var wildcardLocal = 'p';

  import isTrue = Types.isTrue;
  import isFalse = Types.isFalse;
  import isIn = Types.isIn;

  import MutatingVisitor = Compiler.MutatingVisitor;
  import Syntax = Compiler.Syntax;
  import hasTag = Syntax.hasTag;
  import isStatements = Syntax.isStatements;
  import isLiteral = Syntax.isLiteral;
  import annotate = Compiler.annotate;

  type FunctionOrLambda = Syntax.FunctionDeclaration|Syntax.LambdaExpression;
  
  type NodeMatcher = (node: Syntax.NodeOrNodes) => boolean;
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
    'not':    function (v: any) { return isFalse(v); },
    'neg':    function (v: any) { return -v; },
    'add':    function (l: any, r: any) { return l + r; },
    'sub':    function (l: any, r: any) { return l - r; },
    'mul':    function (l: any, r: any) { return l * r; },
    'div':    function (l: any, r: any) { return l / r; },
    'eq':     function (l: any, r: any) { return l === r; },
    'neq':    function (l: any, r: any) { return l !== r; },
    'in':     function (l: any, r: any) { return isIn(l, r); },
    'notIn':  function (l: any, r: any) { return !isIn(l, r); },
    'gt':     function (l: any, r: any) { return l > r; },
    'lt':     function (l: any, r: any) { return l < r; },
    'gte':    function (l: any, r: any) { return l >= r; },
    'lte':    function (l: any, r: any) { return l <= r; },
    'mod':    function (l: any, r: any) { return l % r; }
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

  export function rewriteSyntaxTree(syntaxTree: Syntax.Statements,
                                    warnings?: CompileErrors) {
    var visit = new MutatingVisitor(warnings);
    var wildcardNumbering = 0;

    var foldableShortCircuit = visit.tags(shortCircuitFolderKeys);
    var foldableConstant = visit.tags(constantFolderKeys);
    var nestedPattern = visit.ancestorTags('pattern', 'pattern');
    var patternCollection = visit.ancestorTags(['object', 'array'], 'pattern');
    var patternWildcard = visit.ancestorTags('wildcard', 'pattern');
    var patternNode = visit.ancestorTags('*', 'pattern');
    var collection = visit.tags(['object', 'array']);
    var selfFunctions = visit.ancestorTags('self', ['function', 'lambda']);

    var pipeline = [
      visit.matching(foldShortCircuits, foldableShortCircuit),
      visit.matching(foldConstants, foldableConstant),

      visit.matching(rollUpPatterns, nestedPattern),
      visit.matching(namePatterns, visit.tags('pattern')),
      visit.matching(nameWildcardAnchors, patternCollection),
      visit.matching(nameAndAnnotateWildcards, patternWildcard),
      visit.matching(annotatePatternNode, patternNode),

      visit.matching(rollUpObjectsAndArrays, collection),

      visit.statements(foldIfStatements),
      visit.matching(flipConditionals, visit.tags('conditional')),
      visit.matching(flipEquality, visit.tags('not')),
      visit.matching(promoteNot, visit.tags(['and', 'or'])),

      visit.statementGroups(mergeFunctions, visit.tags('function')),

      visit.matching(rollUpForLoops, visit.tags('for')),

      visit.matching(annotateMutations, visit.tags('let')),
      visit.matching(annotateSelfFunctions, selfFunctions)
    ];

    pipeline.forEach(function (func) {
      syntaxTree = <Syntax.Statements>func(syntaxTree);
    });

    return syntaxTree;

    function annotateNearestParent(name: string, matcher: NodeMatcher) {
      var node = <Syntax.Node>visit.upTreeUntilMatch(matcher);
      if ( node ) {
        annotate(node, name);
      }
    }

    // Patterns don't have to exist within Patterns
    function rollUpPatterns(node: Syntax.Pattern) {
      return node.left;
    }

    function getAnchorName() {
      var anchor = visit.currentElement();
      if ( !anchor ) {
        anchor = visit.hasAncestorTags('pattern')[0];
      }
      var anchorName = hasAnnotation(anchor, 'pattern/local');
      if ( !anchorName ) {
        anchorName = wildcardLocal + (wildcardNumbering++);
        annotate(anchor, 'pattern/local', anchorName);
      }
      return anchorName;
    }

    function namePatterns(node: Syntax.Pattern) {
      if ( !hasAnnotation(node, 'pattern/local') ) {
        annotate(node, 'pattern/local', wildcardLocal);
      }
      var contained = node.left;
      if ( !hasTag(contained, ['object', 'array']) &&
           !hasAnnotation(contained, 'pattern/local') ) {
        annotate(contained, 'pattern/local', wildcardLocal);
      }
      return node;
    }

    function nameWildcardAnchors(node: Syntax.ElementsConstructor) {
      if ( hasAnnotation(node, 'pattern/local') ) {
        return node;
      }

      annotate(node, 'pattern/local', getAnchorName());
      node.elements.forEach(function (element) {
        if ( hasAnnotation(element, 'pattern/local') ) {
          return;
        }
        var elementName = wildcardLocal + (wildcardNumbering++);
        annotate(element, 'pattern/local', elementName);
      });
      return node;
    }

    // Wildcard names must correspond to their element in an object or array
    function nameAndAnnotateWildcards(node: Syntax.Wildcard) {
      if ( !hasAnnotation(node, 'pattern/local') ) {
        annotate(node, 'pattern/local', getAnchorName());
      }
      visit.upTreeUntilMatch(visit.tags('pattern'), annotateWildcard);
      return node;

      function annotateWildcard(node: Syntax.Node) {
        annotate(node, 'pattern/wildcard');
        return node;
      }
    }

    // All nodes inside of a Pattern should be annotated as such,
    // so that the Code Generator can branch appropriately
    function annotatePatternNode(node: Syntax.Node) {
      annotate(node, 'pattern/node');
      return node;
    }

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

    // We can merge consecutive non-recursive functions that are
    // argument compatible
    function mergeFunctions(statements: Syntax.FunctionDeclaration[]) {
      var group: Syntax.FunctionDeclaration[] = [];
      var result: Syntax.Statement[] = [];
      var lastName: string;
      var lastArgs: string;

      statements.forEach(function (statement) {
        var signature = statement.signature;
        var name = signature.id.value;
        var args = argumentsSignature(signature.params);

        if ( name !== lastName || args !== lastArgs ) {
          processGroup();
        }

        if ( !signature.guard && group.length ) {
          // if we see an unguarded, we can blow away the previous funcs
          group = [];
        }

        lastName = name;
        lastArgs = args;
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

    function annotateMutations(node: Syntax.LetStatement) {
      node.assignments.forEach(function (assignment) {
        annotateNearestParent(
          'mutation/' + assignment.id.value,
          visit.tagsOrRoot(['channel', 'function', 'for'])
        );
      });
      return node;
    }
    
    function annotateSelfFunctions(node: Syntax.Self) {
      annotateNearestParent(
        'function/self', visit.tagsOrRoot(['function', 'lambda'])
      );
      return node;
    }
  }

  function argumentsSignature(params: Syntax.Parameters) {
    if ( !params || !params.length ) {
      return '';
    }

    return params.map(function (param) {
      return param.id.value;
    }).join(',');
  }
}
