"use strict";

import Visitor from './Visitor';
import * as Syntax from './Syntax';
import { annotate, getAnnotation, hasAnnotation } from './Annotations';

interface NumberMap {
  [index: string]: number;
}

const collectionAnchorTags = [
  'objectPattern', 'arrayPattern', 'patternElement'
];

const patternAnchorTags = collectionAnchorTags.concat(['pattern']);

const selfPatternLocal = 'p';

const patternNodeComplexity: NumberMap = {
  'match': 5,
  'objectPattern': 4,
  'arrayPattern': 4,
  'patternElement': 2,
  'call': 3,
  'regex': 2,
  'like': 2
};

export default function createTreeProcessors(visit: Visitor) {
  let selfPatternNumbering = 0;

  let nestedPattern = visit.ancestorTags('pattern', 'pattern');
  let nestedSelf = visit.ancestorTags('self', 'pattern');
  let collectionAnchors = visit.ancestorTags(collectionAnchorTags, 'pattern');

  return [
    visit.matching(rollUpPatterns, nestedPattern),
    visit.matching(annotatePattern, visit.tags('pattern')),
    visit.breadthMatching(annotateCollectionAnchors, collectionAnchors),
    visit.breadthMatching(annotateSelf, nestedSelf),
    visit.matching(annotateComplexity, visit.isNode),
    visit.matching(buildPatternGuards, visit.tags('signature')),
    visit.matching(annotatePatternEquality, visit.tags('pattern')),
    visit.matching(annotateElementEquality, visit.tags('patternElement'))
  ];

  // patterns don't always have to exist within Patterns
  function rollUpPatterns(node: Syntax.Pattern) {
    let parent = <Syntax.Node>visit.getParent(node);
    if ( !Syntax.hasTag(parent, patternAnchorTags) ) {
      return node;
    }
    return node.left;
  }

  function annotatePattern(node: Syntax.Pattern) {
    annotate(node, 'pattern/local', selfPatternLocal);
    annotate(node.left, 'pattern/local', selfPatternLocal);
    return node;
  }

  function getPatternAnchorParent() {
    let matches = visit.hasAncestorTags(patternAnchorTags);
    return matches ? matches[0] : null;
  }

  function annotateCollectionAnchors(node: Syntax.Node) {
    let parent = getPatternAnchorParent();

    /* istanbul ignore next */
    if ( !parent ) {
      throw new Error("Stupid Coder: A collection pattern with no parent");
    }

    let parentLocal = getAnnotation(parent, 'pattern/local');
    annotate(node, 'pattern/parent', parentLocal);

    let localId = selfPatternLocal + (selfPatternNumbering++);
    annotate(node, 'pattern/local', localId);
    return node;
  }

  function annotateSelf(node: Syntax.Self) {
    let parent = getPatternAnchorParent();
    let parentLocal = getAnnotation(parent, 'pattern/local');
    annotate(node, 'pattern/parent', parentLocal);
    annotate(node, 'pattern/local', parentLocal);
    visit.upTreeUntilMatch(visit.tags(patternAnchorTags), annotateNode);
    return node;

    function annotateNode(nodeToAnnotate: Syntax.Node) {
      annotate(nodeToAnnotate, 'pattern/parent', parentLocal);
      return nodeToAnnotate;
    }
  }

  function annotateComplexity(node: Syntax.Node) {
    let anchor = visit.findAncestor('pattern');
    if ( anchor ) {
      let complexity = getAnnotation(anchor, 'pattern/complexity') || 0;
      let delta = patternNodeComplexity[node.tag] || 1;
      annotate(anchor, 'pattern/complexity', complexity + delta);
    }
    return node;
  }

  function buildPatternGuards(node: Syntax.Signature) {
    let newGuards: Syntax.Expressions = [];

    // Generate Guards from the Parameters
    let params = node.params;
    params.forEach((param, idx) => {
      if ( param instanceof Syntax.PatternParameter ) {
        let ident = param.id || param.template('id', idx);
        params[idx] = ident.template('idParam', ident, param.cardinality);
        newGuards.push(ident.template('call', param.pattern, [ident]));
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

  function canGenerateEquality(elementValue: Syntax.Node) {
    return !hasAnnotation(elementValue, 'pattern/parent') &&
           !(elementValue instanceof Syntax.RelationalOperator);
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
