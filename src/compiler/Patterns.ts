"use strict";

import Visitor from './Visitor';
import * as Syntax from './Syntax';
import { annotate, getAnnotation, hasAnnotation } from './Annotations';

import hasTag = Syntax.hasTag;

const selfPatternLocal = 'p';

export default function createTreeProcessors(visit: Visitor) {
  let selfPatternNumbering = 0;

  let nestedPattern = visit.ancestorTags('pattern', 'pattern');
  let patternCollection = visit.ancestorTags(['object', 'array'], 'pattern');
  let selfPattern = visit.ancestorTags('self', 'pattern');
  let patternNodes = visit.ancestorTags(['object', 'array'], 'pattern');

  return [
    visit.matching(rollUpPatterns, nestedPattern),
    visit.matching(rollUpPatternSymbols, visit.tags('pattern')),
    visit.matching(namePatterns, visit.tags('pattern')),
    visit.matching(nameSelfPatternAnchors, patternCollection),
    visit.matching(nameAndAnnotateSelfPatterns, selfPattern),
    visit.matching(annotatePatternNode, patternNodes),
    visit.matching(buildPatternGuards, visit.tags('signature'))
  ];

  // patterns don't have to exist within Patterns
  function rollUpPatterns(node: Syntax.Pattern) {
    return node.left;
  }

  function rollUpPatternSymbols(node: Syntax.Pattern) {
    if ( node.left instanceof Syntax.PatternSymbol ) {
      return node.left;
    }
    return node;
  }

  function getAnchorName() {
    let anchor = visit.currentElement();
    if ( !anchor ) {
      anchor = visit.hasAncestorTags('pattern')[0];
    }
    let anchorName = getAnnotation(anchor, 'pattern/local');
    if ( !anchorName ) {
      anchorName = selfPatternLocal + (selfPatternNumbering++);
      annotate(anchor, 'pattern/local', anchorName);
    }
    return anchorName;
  }

  function namePatterns(node: Syntax.Pattern) {
    if ( !hasAnnotation(node, 'pattern/local') ) {
      annotate(node, 'pattern/local', selfPatternLocal);
    }
    let contained = node.left;
    if ( !hasTag(contained, ['object', 'array']) &&
         !hasAnnotation(contained, 'pattern/local') ) {
      annotate(contained, 'pattern/local', selfPatternLocal);
    }
    return node;
  }

  function nameSelfPatternAnchors(node: Syntax.ElementsConstructor) {
    annotate(node, 'pattern/local', getAnchorName());
    node.elements.forEach(function (element) {
      if ( hasAnnotation(element, 'pattern/local') ) {
        return;
      }
      let elementName = selfPatternLocal + (selfPatternNumbering++);
      annotate(element, 'pattern/local', elementName);
    });
    return node;
  }

  // pattern names must correspond to their element in an object or array
  function nameAndAnnotateSelfPatterns(node: Syntax.Self) {
    if ( !hasAnnotation(node, 'pattern/local') ) {
      annotate(node, 'pattern/local', getAnchorName());
    }
    visit.upTreeUntilMatch(visit.tags('pattern'), annotateSelfPattern);
    return node;

    function annotateSelfPattern(nodeToAnnotate: Syntax.Node) {
      annotate(nodeToAnnotate, 'pattern/self');
      return nodeToAnnotate;
    }
  }

  // all top-level Objects/Arrays inside of a Pattern should be annotated
  // as such, so that the Code Generator can branch appropriately
  function annotatePatternNode(node: Syntax.Node) {
    let nodeStack = visit.nodeStack.slice().reverse();
    for ( let i = 0; i < nodeStack.length; i++ ) {
      if ( !(nodeStack[i] instanceof Syntax.Node) ) {
        continue;
      }

      let parent = <Syntax.Node>nodeStack[i];
      if ( parent.tag === 'pattern' ) {
        annotate(node, 'pattern/node');
        return node;
      }

      if ( !hasTag(parent, ['index', 'objectAssignment', 'object', 'array']) ) {
        // Not going to work
        return node;
      }
    }
    /* istanbul ignore next: should be properly matched */
    throw new Error("Stupid Coder: Didn't stop at Pattern Node");
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
}
