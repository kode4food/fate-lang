/** @flow */

import * as Syntax from '../syntax';

const {
  Visitor, annotate, getAnnotation, hasAnnotation,
} = Syntax;

type NumberMap = {
  [index: string]: number;
}

const collectionTags = ['objectPattern', 'arrayPattern'];
const patternParentTags = ['pattern', 'patternElement'];

const contextPatternLocal = 'p';

const patternNodeComplexity: NumberMap = {
  match: 5,
  objectPattern: 4,
  arrayPattern: 4,
  patternElement: 2,
  call: 3,
  regex: 2,
  like: 2,
};

export default function createTreeProcessors(visit: Visitor) {
  let contextPatternNumbering = 0;

  const nestedPattern = visit.ancestorTags('pattern', 'pattern');
  const nestedContext = visit.ancestorTags('context', 'pattern');
  const collections = visit.ancestorTags(collectionTags, 'pattern');

  return [
    visit.matching(rollUpPatterns, nestedPattern),
    visit.matching(annotatePattern, visit.tags('pattern')),
    visit.matching(validateContext, visit.tags('context')),
    visit.breadthMatching(annotateCollection, collections),
    visit.breadthMatching(annotateContext, nestedContext),
    visit.matching(annotateComplexity, visit.isNode),

    visit.byTag({
      signature: buildPatternGuards,
      pattern: annotatePatternEquality,
      patternElement: annotateElementEquality,
    }),
  ];

  function getParent() {
    const { nodeStack } = visit;
    return nodeStack[nodeStack.length - 1];
  }

  // patterns don't always have to exist within Patterns
  function rollUpPatterns(node: Syntax.Pattern) {
    const parent = getParent();
    if (!Syntax.hasTag(parent, patternParentTags)) {
      return node;
    }
    return node.left;
  }

  function annotatePattern(node: Syntax.Pattern) {
    annotate(node, 'pattern/local', contextPatternLocal);
    annotate(node.left, 'pattern/local', contextPatternLocal);
    return node;
  }

  function getPatternParent() {
    const matches = visit.hasAncestorTags(patternParentTags);
    return matches && matches[0];
  }

  function annotateCollection(node: Syntax.CollectionPattern) {
    const parent = getPatternParent();
    const parentLocal = getAnnotation(parent, 'pattern/local');
    annotate(node, 'pattern/parent', parentLocal);
    annotate(node, 'pattern/local', parentLocal);

    node.elements.forEach((element) => {
      if (element instanceof Syntax.PatternElement) {
        const localId = contextPatternLocal + (contextPatternNumbering++);
        annotate(element, 'pattern/parent', parentLocal);
        annotate(element, 'pattern/local', localId);
      }
    });
    return node;
  }

  function validateContext(node: Syntax.Context) {
    if (!getPatternParent()) {
      visit.issueError(node,
        'Relative references must appear within a Pattern');
    }
    return node;
  }

  function annotateContext(node: Syntax.Context) {
    const parent = getPatternParent();
    const parentLocal = getAnnotation(parent, 'pattern/local');
    annotate(node, 'pattern/context', parentLocal);
    annotate(node, 'pattern/local', parentLocal);
    visit.upTreeUntilMatch(visit.tags(patternParentTags), annotateNode);
    return node;

    function annotateNode(nodeToAnnotate: Syntax.Node) {
      annotate(nodeToAnnotate, 'pattern/parent', parentLocal);
      return nodeToAnnotate;
    }
  }

  function annotateComplexity(node: Syntax.Node) {
    const anchor = visit.findAncestor('pattern');
    if (anchor) {
      const complexity = getAnnotation(anchor, 'pattern/complexity') || 0;
      const delta = patternNodeComplexity[node.tag] || 1;
      annotate(anchor, 'pattern/complexity', complexity + delta);
    }
    return node;
  }

  function buildPatternGuards(node: Syntax.Signature) {
    const newGuards: Syntax.Expressions = [];

    // Generate Guards from the Parameters
    const { params } = node;
    params.forEach((param, idx) => {
      if (param instanceof Syntax.PatternParameter) {
        const ident = param.id || param.template('id', idx);
        params[idx] = ident.template('idParam', ident, param.cardinality);
        newGuards.push(ident.template('call', param.pattern, [ident]));
      }
    });

    // Combine the Guards
    if (newGuards.length) {
      if (node.guard) {
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

  function canGenerateEquality(elementValue: Syntax.Node) {
    return !hasAnnotation(elementValue, 'pattern/parent')
           && !(elementValue instanceof Syntax.RelationalOperator);
  }

  function annotatePatternEquality(node: Syntax.Pattern) {
    annotate(node.left, 'pattern/equality', canGenerateEquality(node.left));
    return node;
  }

  function annotateElementEquality(node: Syntax.PatternElement) {
    annotate(node.value, 'pattern/equality', canGenerateEquality(node.value));
    return node;
  }
}
