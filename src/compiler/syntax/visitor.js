/** @flow */

import type { CompileErrors } from '../index';

import * as Syntax from './index';
import { CompileError } from '../index';

const { isArray } = Array;

type NodeStackElement = Syntax.NodeOrNodes;
type NodeVisitor = (node: NodeStackElement) => any;
type StatementsVisitor = (node: Syntax.Statement[]) => any;
type NodeMatcher = (node: NodeStackElement) => boolean;

interface VisitorMap {
  [index: string]: Function;
}

export class Visitor {
  warnings: CompileErrors;
  nodeStack: NodeStackElement[];

  constructor(warnings: CompileErrors) {
    this.warnings = warnings;
    this.nodeStack = [];
  }

  ancestorTags(...tags: Syntax.TagOrTags[]) {
    return this.ancestry(...tags.map(this.tags));
  }

  ancestry(matcher: NodeMatcher, ...matchers: NodeMatcher[]) {
    return (node: Syntax.Node) => {
      if (!matcher(node)) {
        return false;
      }
      return this.hasAncestry(...matchers) !== undefined;
    };
  }

  hasAncestorTags(...tags: Syntax.TagOrTags[]) {
    const args = tags.map(this.tags);
    return this.hasAncestry(...args);
  }

  hasAncestry(...matchers: NodeMatcher[]) {
    let matcher = matchers.shift();
    const stack = this.nodeStack.slice().reverse();
    const result: NodeStackElement[] = [];
    while (stack.length) {
      const node = stack.shift();
      if (matcher(node)) {
        result.push(node);
        matcher = matchers.shift();
        if (!matcher) {
          return result;
        }
      }
    }
    return undefined;
  }

  findAncestor(tag: Syntax.TagOrTags): ?Syntax.Node {
    const { nodeStack } = this;
    for (let i = nodeStack.length - 1; i >= 0; i--) {
      const node: NodeStackElement = nodeStack[i];
      if (node instanceof Syntax.Node && Syntax.hasTag(node, tag)) {
        return node;
      }
    }
    return undefined;
  }

  nodes(startNode: NodeStackElement, matcher: NodeMatcher,
        visitor: NodeVisitor, breadthFirst: boolean = false) {
    const self = this;
    return visitNode(startNode);

    function visitNode(node: NodeStackElement): NodeStackElement {
      if (!(node instanceof Syntax.Node) && !isArray(node)) {
        return node;
      }

      if (!matcher(node)) {
        return self.recurseInto(node, visitNode);
      }

      if (breadthFirst) {
        return self.recurseInto(visitor(node), visitNode);
      }
      return visitor(self.recurseInto(node, visitNode));
    }
  }

  recurseInto(node: NodeStackElement, visitor: NodeVisitor) {
    const { nodeStack } = this;
    nodeStack.push(node);
    if (isArray(node)) {
      const arrNode = node;
      for (let i = 0, len = arrNode.length; i < len; i++) {
        arrNode[i] = visitor(arrNode[i]);
      }
    } else {
      const currentNode = node;
      const keys = currentNode.visitorKeys || Object.keys(currentNode);
      keys.forEach((key) => {
        currentNode[key] = visitor(currentNode[key]);
      });
    }
    nodeStack.pop();
    return node;
  }

  matching(visitor: NodeVisitor, matcher: NodeMatcher) {
    return (node: Syntax.Node) => this.nodes(node, matcher, visitor);
  }

  breadthMatching(visitor: NodeVisitor, matcher: NodeMatcher) {
    return (node: Syntax.Node) => this.nodes(node, matcher, visitor, true);
  }

  byTag(visitorMap: VisitorMap) {
    return this.createByTagMatcher(visitorMap, this.matching);
  }

  breadthByTag(visitorMap: VisitorMap) {
    return this.createByTagMatcher(visitorMap, this.breadthMatching);
  }

  statements(visitor: StatementsVisitor) {
    return (node: Syntax.Node) => this.nodes(
      node, Syntax.isStatements,
      statementsProcessor,
    );

    function statementsProcessor(node: Syntax.Statements) {
      node.statements = visitor(node.statements);
      return node;
    }
  }

  // Iterates over a set of statements and presents adjacent groups
  // to the callback function for replacement
  statementGroups(visitor: StatementsVisitor, matcher: NodeMatcher,
                  minGroupSize: number) {
    return this.statements(groupProcessor);

    function groupProcessor(statements: Syntax.Statement[]) {
      let group: Syntax.Statement[] = [];
      let output: Syntax.Statement[] = [];

      statements.forEach((statement) => {
        if (matcher(statement)) {
          group.push(statement);
        } else {
          processMatches();
          output.push(statement);
        }
      });

      processMatches();
      return output;

      function processMatches() {
        const result = group.length < minGroupSize ? group : visitor(group);
        output = output.concat(result);
        group = [];
      }
    }
  }

  // eslint-disable-next-line class-methods-use-this
  isNode(node: Syntax.Node) {
    return node instanceof Syntax.Node;
  }

  // eslint-disable-next-line class-methods-use-this
  tags(...args: any[]) {
    let tags: Syntax.TagOrTags = args[0];
    if (!isArray(tags)) {
      tags = args;
    }
    return matcher;

    function matcher(node: Syntax.Node) {
      return Syntax.hasTag(node, tags);
    }
  }

  upTreeUntilMatch(matcher: NodeMatcher,
                   visitor: NodeVisitor): NodeStackElement {
    const { nodeStack } = this;
    for (let i = nodeStack.length - 1; i >= 0; i--) {
      const node: NodeStackElement = nodeStack[i];
      visitor(node);
      if (matcher(node)) {
        return node;
      }
    }
    throw new Error("Stupid Coder: upTreeUntilMatch didn't match");
  }

  // eslint-disable-next-line class-methods-use-this
  issueError(source: Syntax.Node, message: string) {
    throw new CompileError(message, source.line, source.column);
  }

  issueWarning(source: Syntax.Node, message: string) {
    this.warnings.push(
      new CompileError(message, source.line, source.column),
    );
  }

  createByTagMatcher(visitorMap: VisitorMap, method: Function) {
    const nodesToVisit = this.tags(Object.keys(visitorMap));
    const visitNode = (node: Syntax.Node) => visitorMap[node.tag](node);
    return method.call(this, visitNode, nodesToVisit);
  }
}
