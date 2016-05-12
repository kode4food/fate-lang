"use strict";

import * as Syntax from './Syntax';
import { CompileError, CompileErrors } from './Compiler';

const slice = Array.prototype.slice;

type NodeVisitor = (node: Syntax.NodeOrNodes) => any;
type StatementsVisitor = (node: Syntax.Statement[]) => any;
type NodeMatcher = (node: Syntax.NodeOrNodes) => boolean;

class Index extends Syntax.Node {
  public tag = 'index';
  constructor(public value: number) { super(); }
}

export default class Visitor {
  public nodeStack: (Syntax.Node|Syntax.Nodes)[] = [];

  constructor(public warnings: CompileErrors) {}

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
    let args = tags.map(this.tags);
    return this.hasAncestry.apply(this, args);
  }

  public hasAncestry(...matchers: NodeMatcher[]) {
    let matcher = matchers.shift();
    let stack = this.nodeStack.slice().reverse();
    let result: (Syntax.Node|Syntax.Nodes)[] = [];
    while ( stack.length ) {
      let node = stack.shift();
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

  public nodes(startNode: Syntax.Node|Syntax.Nodes, matcher: NodeMatcher,
               visitor: NodeVisitor, breadthFirst = false) {
    let self = this;
    return visitNode(startNode);

    function visitNode(node: Syntax.NodeOrNodes): Syntax.NodeOrNodes {
      if ( !(node instanceof Syntax.Node) && !Array.isArray(node) ) {
        return node;
      }

      if ( !matcher(node) ) {
        return self.recurseInto(node, visitNode);
      }

      if ( breadthFirst ) {
        return self.recurseInto(visitor(node), visitNode);
      }
      return visitor(self.recurseInto(node, visitNode));
    }
  }

  public recurseInto(node: Syntax.NodeOrNodes, visitor: NodeVisitor) {
    let nodeStack = this.nodeStack;
    nodeStack.push(node);
    if ( Array.isArray(node) ) {
      let arrNode = <Syntax.Nodes>node;
      for ( let i = 0, len = arrNode.length; i < len; i++ ) {
        nodeStack.push(new Index(i));
        arrNode[i] = <Syntax.Node>visitor(arrNode[i]);
        nodeStack.pop();
      }
    }
    else {
      let currentNode = <Syntax.Node>node;
      let keys = currentNode.visitorKeys || Object.keys(currentNode);
      keys.forEach(key => {
        currentNode[key] = visitor(currentNode[key]);
      });
    }
    nodeStack.pop();
    return node;
  }

  public matching(visitor: NodeVisitor, matcher: NodeMatcher) {
    return (node: Syntax.Node) => {
      return this.nodes(node, matcher, visitor);
    };
  }

  public breadthMatching(visitor: NodeVisitor, matcher: NodeMatcher) {
    return (node: Syntax.Node) => {
      return this.nodes(node, matcher, visitor, true);
    };
  }

  public statements(visitor: StatementsVisitor) {
    return (node: Syntax.Node) => {
      return this.nodes(node, Syntax.isStatements, statementsProcessor);
    };

    function statementsProcessor(node: Syntax.Statements) {
      node.statements = visitor(node.statements);
      return node;
    }
  }

  // Iterates over a set of statements and presents adjacent groups
  // to the callback function for replacement
  public statementGroups(visitor: StatementsVisitor, matcher: NodeMatcher,
                         minGroupSize = 2) {
    return this.statements(groupProcessor);

    function groupProcessor(statements: Syntax.Statement[]) {
      let group: Syntax.Statement[] = [];
      let output: Syntax.Statement[] = [];

      statements.forEach(statement => {
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
        let result = group.length < minGroupSize ? group : visitor(group);
        output = output.concat(result);
        group = [];
      }
    }
  }

  public tags(tags: Syntax.TagOrTags) {
    if ( !Array.isArray(tags) ) {
      tags = slice.call(arguments, 0);
    }
    return matcher;

    function matcher(node: Syntax.Node) {
      return Syntax.hasTag(node, tags);
    }
  }

  public currentElement() {
    let ancestors = this.hasAncestorTags(['object', 'array'], 'pattern');
    if ( !ancestors ) {
      return null;
    }
    let collectionIndex = this.nodeStack.indexOf(ancestors[0]);
    let collection = <Syntax.Nodes>this.nodeStack[collectionIndex + 1];
    let index = <Index>(this.nodeStack[collectionIndex + 2]);
    return collection[index.value];
  }

  public upTreeUntilMatch(matcher: NodeMatcher,
                          visitor: NodeVisitor): Syntax.NodeOrNodes {
    let nodeStack = this.nodeStack;
    for ( let i = nodeStack.length - 1; i >= 0; i-- ) {
      let node: Syntax.NodeOrNodes = nodeStack[i];
      visitor(node);
      if ( matcher(node) ) {
        return node;
      }
    }
    /* istanbul ignore next: should be properly matched */
    throw new Error("Stupid Coder: upTreeUntilMatch didn't match");
  }

  public issueError(source: Syntax.Node, message: string) {
    throw new CompileError(message, source.line, source.column);
  }

  public issueWarning(source: Syntax.Node, message: string) {
    this.warnings.push(
      new CompileError(message, source.line, source.column)
    );
  }
}
