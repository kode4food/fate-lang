/// <reference path="../Types.ts"/>
/// <reference path="./Syntax.ts"/>

"use strict";

namespace Fate.Compiler {
  import isTrue = Types.isTrue;
  import isFalse = Types.isFalse;
  import isIn = Types.isIn;

  import Syntax = Compiler.Syntax;
  import hasTag = Syntax.hasTag;
  import isStatements = Syntax.isStatements;
  import isLiteral = Syntax.isLiteral;

  var slice = Array.prototype.slice;

  type NodeVisitor = (node: Syntax.NodeOrNodes) => any;
  type StatementsVisitor = (node: Syntax.Statement[]) => any;
  type NodeMatcher = (node: Syntax.NodeOrNodes) => boolean;

  class Index extends Syntax.Node {
    public tag = 'index';
    constructor(public value: number) { super(); }
  }

  export class Visitor {
    public nodeStack: (Syntax.Node|Syntax.Nodes)[] = [];

    constructor(public warnings?: CompileErrors) {
      if ( !warnings ) {
        this.warnings = [];
      }
    }

    public ancestorTags(...tags: Syntax.TagOrTags[]) {
      return this.ancestry.apply(this, tags.map(this.tags));
    }

    public ancestry(matcher: NodeMatcher, ...matchers: NodeMatcher[]) {
      return (node: Syntax.Node) => {
        if ( !matcher(node) ) {
          return false;
        }
        return this.hasAncestry.apply(this, matchers) !== undefined;
      };
    }

    public hasAncestorTags(...tags: Syntax.TagOrTags[]) {
      var args = tags.map(this.tags);
      return this.hasAncestry.apply(this, args);
    }

    public hasAncestry(...matchers: NodeMatcher[]) {
      var matcher = matchers.shift();
      var stack = this.nodeStack.slice().reverse();
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

    public nodes(node: Syntax.Node|Syntax.Nodes, visitor: NodeVisitor,
                 matcher: NodeMatcher) {
      var self = this;
      return visitNode(node);

      function visitNode(node: Syntax.Node|Syntax.Nodes) {
        if ( !(node instanceof Syntax.Node) && !Array.isArray(node) ) {
          return node;
        }

        // Depth-first Processing
        node = self.recurseInto(node, visitNode);

        // Now the real work
        if ( matcher(node) ) {
          return visitor(node);
        }
        return node;
      }
    }
    
    public recurseInto(node: Syntax.Node|Syntax.Nodes,
                       visitor: NodeVisitor) {
      var nodeStack = this.nodeStack;
      nodeStack.push(node);
      if ( Array.isArray(node) ) {
        var arrNode = <Syntax.Nodes>node;
        for ( var i = 0, len = arrNode.length; i < len; i++ ) {
          nodeStack.push(new Index(i));
          visitor(arrNode[i]);
          nodeStack.pop();
        }
      }
      else {
        var currentNode = <Syntax.Node>node;
        Object.keys(currentNode).forEach(function (key) {
          visitor(currentNode[key]);
        });
      }
      nodeStack.pop();
      return node;
    }

    public matching(visitor: NodeVisitor, matcher: NodeMatcher) {
      return (node: Syntax.Node) => {
        return this.nodes(node, visitor, matcher);
      };
    }

    public statements(visitor: StatementsVisitor) {
      return (node: Syntax.Node) => {
        return this.nodes(node, statementsProcessor, isStatements);
      };

      function statementsProcessor(node: Syntax.Statements) {
        node.statements = visitor(node.statements);
        return node;
      }
    }

    // Iterates over a set of statements and presents adjacent groups
    // to the callback function for replacement
    public statementGroups(visitor: StatementsVisitor, matcher: NodeMatcher) {
      return this.statements(groupProcessor);

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

    public tagsOrRoot(tags: Syntax.TagOrTags) {
      var nodeStack = this.nodeStack;
      var tagMatcher = this.tags(tags);
      return matcher;

      function matcher(node: Syntax.Node) {
        var tag = tagMatcher(node);
        if ( tag ) {
          return tag;
        }
        return !nodeStack.length || nodeStack[0] === node;
      }
    }

    public tags(tags: Syntax.TagOrTags) {
      if ( !Array.isArray(tags) ) {
        tags = slice.call(arguments, 0);
      }
      return matcher;

      function matcher(node: Syntax.Node) {
        return hasTag(node, tags);
      }
    }

    public currentElement() {
      var ancestors = this.hasAncestorTags(['object', 'array'], 'pattern');
      if ( !ancestors ) {
        return null;
      }
      var collectionIndex = this.nodeStack.indexOf(ancestors[0]);
      var collection = <Syntax.Nodes>this.nodeStack[collectionIndex + 1];
      var index = <Index>(this.nodeStack[collectionIndex + 2]);
      return collection[index.value];
    }

    public upTreeUntilMatch(visitor: NodeVisitor, matcher: NodeMatcher) {
      var nodeStack = this.nodeStack;
      for ( var i = nodeStack.length - 1; i >= 0; i-- ) {
        var node = <Syntax.Node>nodeStack[i];
        visitor(node);
        if ( matcher(node) ) {
          return node;
        }
      }
      return null;
    }
  }
  
  export class MutatingVisitor extends Visitor {
    public recurseInto(node: Syntax.Node|Syntax.Nodes,
                       visitor: NodeVisitor) {
      var nodeStack = this.nodeStack;
      nodeStack.push(node);
      if ( Array.isArray(node) ) {
        var arrNode = <Syntax.Nodes>node;
        for ( var i = 0, len = arrNode.length; i < len; i++ ) {
          nodeStack.push(new Index(i));
          arrNode[i] = <Syntax.Node>visitor(arrNode[i]);
          nodeStack.pop();
        }
      }
      else {
        var currentNode = <Syntax.Node>node;
        Object.keys(currentNode).forEach(function (key) {
          currentNode[key] = visitor(currentNode[key]);
        });
      }
      nodeStack.pop();    
      return node;  
    }    
  }
}
