/// <reference path="../Types.ts"/>
/// <reference path="./Annotations.ts"/>
/// <reference path="./Syntax.ts"/>

"use strict";

namespace Fate.Compiler.Rewriter {
  var wildcardLocal = 'p';

  import isTruthy = Types.isTruthy;
  import isFalsy = Types.isFalsy;
  import isIn = Types.isIn;

  import Syntax = Compiler.Syntax;
  import hasTag = Syntax.hasTag;
  import isStatements = Syntax.isStatements;
  import isLiteral = Syntax.isLiteral;
  import annotate = Compiler.annotate;

  var slice = Array.prototype.slice;

  type NodeVisitor = (node: Syntax.NodeOrNodes) => Syntax.NodeOrNodes;
  type StatementsVisitor = (node: Syntax.Statement[]) => Syntax.Statement[];
  type NodeMatcher = (node: Syntax.NodeOrNodes) => boolean;
  type LiteralArray = any[];
  type StringMap = { [index: string]: string };
  type FunctionGroups = { [index: string]: Syntax.FunctionDeclaration[] };
  type LiteralObject = { [index: string]: any };
  type FunctionMap = { [index: string]: Function };

  class Index extends Syntax.Node {
    public tag = 'index';
    constructor(public value: number) { super(); }
  }

  var inverseOperators: StringMap = {
    'eq': 'neq', 'neq': 'eq',
    'lt': 'gte', 'gte': 'lt',
    'gt': 'lte', 'lte': 'gt'
  };

  var constantFolders: FunctionMap = {
    'not':    function (v: any) { return isFalsy(v); },
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

  var shortCircuitFolders: FunctionMap = {
    'or': function (node: Syntax.OrOperator) {
      if ( !isLiteral(node.left) ) {
        return node;
      }
      var value = (<Syntax.Literal>node.left).value;
      return isTruthy(value) ? node.left : node.right;
    },
    'and': function (node: Syntax.AndOperator) {
      if ( !isLiteral(node.left) ) {
        return node;
      }
      var value = (<Syntax.Literal>node.left).value;
      return isFalsy(value) ? node.left : node.right;
    },
    'conditional': function (node: Syntax.ConditionalOperator) {
      if ( !isLiteral(node.condition) ) {
        return node;
      }
      var value = (<Syntax.Literal>node.condition).value;
      return isTruthy(value) ? node.trueResult : node.falseResult;
    }
  };

  export function rewriteSyntaxTree(syntaxTree: Syntax.Statements,
                                    warnings?: Warnings) {
    var nodeStack: (Syntax.Node|Syntax.Nodes)[] = [];
    var wildcardNumbering = 0;

    var constantFolderKeys = matchTags(Object.keys(constantFolders));
    var shortCircuitFolderKeys = matchTags(Object.keys(shortCircuitFolders));
    var patternContainers = matchAncestorTags(['object', 'array'], 'pattern');
    var patternWildcards = matchAncestorTags('wildcard', 'pattern');

    var pipeline = [
      visitMatching(foldShortCircuits, shortCircuitFolderKeys),
      visitMatching(foldConstants, constantFolderKeys),

      visitMatching(rollUpPatterns, matchAncestorTags('pattern', 'pattern')),
      visitMatching(validateWildcards, matchTags('wildcard')),
      visitMatching(namePatterns, matchTags('pattern')),
      visitMatching(nameWildcardAnchors, patternContainers),
      visitMatching(nameAndAnnotateWildcards, patternWildcards),
      visitMatching(annotatePatternNode, matchAncestorTags('*', 'pattern')),

      visitMatching(rollUpObjectsAndArrays, matchTags(['object', 'array'])),

      visitStatements(foldIfStatements),
      visitMatching(flipConditionals, matchTags('conditional')),
      visitMatching(flipEquality, matchTags('not')),
      visitMatching(promoteNot, matchTags(['and', 'or'])),

      visitStatementGroups(mergeFunctions, functionStatements),

      visitMatching(rollUpForLoops, matchTags('for')),
      visitMatching(assignFunctions, functionStatements),

      visitMatching(annotateMutations, matchTags('let'))
    ];

    pipeline.forEach(function (func) {
      syntaxTree = <Syntax.Statements>func(syntaxTree);
    });

    return syntaxTree;

    function matchAncestorTags(...tags: Syntax.TagOrTags[]) {
      return matchAncestry.apply(null, tags.map(matchTags));
    }

    function matchAncestry(matcher: NodeMatcher, ...matchers: NodeMatcher[]) {
      return ancestryMatcher;

      function ancestryMatcher(node: Syntax.Node) {
        if ( !matcher(node) ) {
          return false;
        }
        return hasAncestry.apply(null, matchers) !== undefined;
      }
    }

    function hasAncestorTags(...tags: Syntax.TagOrTags[]) {
      var args = tags.map(matchTags);
      return hasAncestry.apply(null, args);
    }

    function hasAncestry(...matchers: NodeMatcher[]) {
      var matcher = matchers.shift();
      var stack = nodeStack.slice().reverse();
      var result: (Syntax.Node|Syntax.Nodes)[] = [];
      while ( stack.length ) {
        var node = stack.shift();
        if ( matcher(node) ) {
          result.push(node);
          matcher = matchers.shift();
          if ( !matcher ) {
            return result;
          }
        }
      }
      return undefined;
    }

    function annotateNearestParent(name: string, matcher: NodeMatcher) {
      for ( var i = nodeStack.length - 1; i >= 0; i-- ) {
        var node = <Syntax.Node>nodeStack[i];
        if ( matcher(node) ) {
          annotate(node, name);
          return;
        }
      }
    }

    function annotateUpTree(name: string, matcher: NodeMatcher) {
      for ( var i = nodeStack.length - 1; i >= 0; i-- ) {
        var node = <Syntax.Node>nodeStack[i];
        annotate(node, name);
        if ( matcher(node) ) {
          return;
        }
      }
    }

    function visitNodes(node: Syntax.Node|Syntax.Nodes, visitor: NodeVisitor,
                        matcher: NodeMatcher) {
      return visitNode(node);

      function visitNode(node: Syntax.Node|Syntax.Nodes) {
        if ( !(node instanceof Syntax.Node) && !Array.isArray(node) ) {
          return node;
        }

        // Depth-first Processing
        nodeStack.push(node);
        if ( Array.isArray(node) ) {
          var arrNode = <Syntax.Nodes>node;
          for ( var i = 0, len = arrNode.length; i < len; i++ ) {
            nodeStack.push(new Index(i));
            arrNode[i] = <Syntax.Node>visitNode(arrNode[i]);
            nodeStack.pop();
          }
        }
        else {
          Object.keys(node).forEach(function (key) {
            node[key] = visitNode(node[key]);
          });
        }
        nodeStack.pop();

        // Now the real work
        if ( matcher(node) ) {
          return visitor(node);
        }
        return node;
      }
    }

    function visitMatching(visitor: NodeVisitor, matcher: NodeMatcher) {
      return nodeVisitor;

      function nodeVisitor(node: Syntax.Node) {
        return visitNodes(node, visitor, matcher);
      }
    }

    function visitStatements(visitor: StatementsVisitor) {
      return statementsVisitor;

      function statementsVisitor(node: Syntax.Node) {
        return visitNodes(node, statementsProcessor, isStatements);
      }

      function statementsProcessor(node: Syntax.Statements) {
        var statements = visitor(node.statements);
        node.statements = statements;
        return node;
      }
    }

    // Iterates over a set of statements and presents adjacent groups
    // to the callback function for replacement
    function visitStatementGroups(visitor: StatementsVisitor,
                                  matcher: NodeMatcher) {
      return visitStatements(groupProcessor);

      function groupProcessor(statements: Syntax.Statement[]) {
        var group: Syntax.Statement[] = [];
        var output: Syntax.Statement[] = [];

        statements.forEach(function (statement) {
          if ( matcher(statement) ) {
            group.push(statement);
          }
          else {
            processMatches();
            output.push(statement);
          }
        });

        processMatches();
        return output;

        function processMatches() {
          var result = group.length < 2 ? group : visitor(group);
          output = output.concat(result);
          group = [];
        }
      }
    }

    // Patterns don't have to exist within Patterns
    function rollUpPatterns(node: Syntax.Pattern) {
      return node.left;
    }

    // A Wildcard can only exist in a pattern or call binder
    function validateWildcards(node: Syntax.Wildcard) {
      if ( !hasAncestorTags(['pattern', 'bind']) ) {
        issueWarning(node, "Unexpected Wildcard");
      }

      var ancestors = hasAncestorTags('objectAssignment', 'pattern');
      if ( ancestors ) {
        var parent = <Syntax.ObjectAssignment>ancestors[0];
        if ( parent.id === nodeStack[nodeStack.indexOf(parent) + 1] ) {
          issueWarning(node, "Wildcards cannot appear in Property Names");
        }
      }
      return node;
    }

    function getCurrentElement() {
      var ancestors = hasAncestorTags(['object', 'array'], 'pattern');
      if ( !ancestors ) {
        return null;
      }
      var collectionIndex = nodeStack.indexOf(ancestors[0]);
      var collection = <Syntax.Nodes>nodeStack[collectionIndex + 1];
      var index = <Index>(nodeStack[collectionIndex + 2]);
      return collection[index.value];
    }

    function getAnchorName() {
      var anchor = getCurrentElement();
      if ( !anchor ) {
        anchor = hasAncestorTags('pattern')[0];
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
      annotateUpTree('pattern/wildcard', matchTags('pattern'));
      return node;
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
      return node.template('lit', output);
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
      var type = 'lit';

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
      var type = 'lit';

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
        if ( isTruthy((<Syntax.Literal>statement.condition).value) ) {
          foldedStatements = statement.thenStatements.statements;
        }
        else {
          foldedStatements = statement.elseStatements.statements;
        }
        output = output.concat(foldedStatements);
      });
      return output;
    }

    function functionStatements(node: Syntax.Node) {
      return (node instanceof Syntax.FunctionDeclaration) &&
             !!node.signature.id;
    }

    // We can combine multiple sequential compatible functions into a
    // single branched function
    function mergeFunctions(statements: Syntax.FunctionDeclaration[]) {
      var namedDefs: FunctionGroups = {};
      statements.forEach(function (statement) {
        var signature = statement.signature;
        var name = signature.id.value;
        var group = namedDefs[name] || ( namedDefs[name] = [] );

        if ( !signature.guard && group.length ) {
          // if we see an unguarded, blow away previous definitions
          issueWarning(statement,
            "The unguarded Function '" + name + "' will replace " +
            "any previous definitions"
          );
          group = [];
        }

        group.push(statement);
      });

      var result: Syntax.Statement[] = [];
      for ( var key in namedDefs ) {
        var definitions = namedDefs[key];
        if ( definitions.length === 1 ) {
          result.push(definitions[0]);
          continue;
        }
        result = result.concat(mergeDefinitions(key, definitions));
      }
      return result;

      function mergeDefinitions(name: string,
                                definitions: Syntax.FunctionDeclaration[]) {
        var firstDefinition = definitions[0];
        var firstSignature = firstDefinition.signature;
        var originalArgs = argumentsSignature(firstSignature.params);
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
        for ( var i = 1, len = definitions.length; i < len; i++ ) {
          var definition = definitions[i];
          var signature = definition.signature;
          var theseArgs = argumentsSignature(signature.params);
          if ( originalArgs !== theseArgs ) {
            // Short-circuit, won't make assumptions about local names
            issueWarning(definition,
              "Reopened Function '" + name + "' has different " +
              "argument names than the original definition"
            );
            return definitions;
          }

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

        return [
          firstDefinition.template('function',
            firstSignature.template('signature',
              firstSignature.id, firstSignature.params, guard
            ),
            firstStatements.template('statements', statements)
          )
        ];
      }
    }

    function matchTags(tags: Syntax.TagOrTags) {
      if ( !Array.isArray(tags) ) {
        tags = slice.call(arguments, 0);
      }
      return matcher;

      function matcher(node: Syntax.Node) {
        return hasTag(node, tags);
      }
    }

    function matchTagsOrRoot(tags: Syntax.TagOrTags) {
      var tagMatcher = matchTags(tags);
      return matcher;

      function matcher(node: Syntax.Node) {
        var tag = tagMatcher(node);
        if ( tag ) {
          return tag;
        }
        return node === syntaxTree;
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

    // Function declarations are really 'let name = function'
    function assignFunctions(node: Syntax.FunctionDeclaration) {
      var id = node.signature.id;
      return Syntax.node('let', [Syntax.node('assignment', id, node)]);
    }

    function annotateMutations(node: Syntax.LetStatement) {
      node.assignments.forEach(function (assignment) {
        annotateNearestParent(
          'mutation/' + assignment.id.value,
          matchTagsOrRoot(['channel', 'function', 'for'])
        );
      });
      return node;
    }

    function issueWarning(source: Syntax.Node, message: string) {
      warnings.push({
        line: source.line,
        column: source.column,
        message: message
      });
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
