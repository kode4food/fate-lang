/// <reference path="../Types.ts"/>
/// <reference path="./Annotations.ts"/>
/// <reference path="./Syntax.ts"/>
/// <reference path="./Visitor.ts"/>

"use strict";

namespace Fate.Compiler.Patterns {
  let selfPatternLocal = 'p';

  import Syntax = Compiler.Syntax;
  import hasTag = Syntax.hasTag;
  import annotate = Compiler.annotate;

  export function createTreeProcessors(visit: Compiler.Visitor) {
    let selfPatternNumbering = 0;

    let nestedPattern = visit.ancestorTags('pattern', 'pattern');
    let patternCollection = visit.ancestorTags(['object', 'array'], 'pattern');
    let selfPattern = visit.ancestorTags('self', 'pattern');
    let patternNode = visit.ancestorTags('*', 'pattern');

    return [
      visit.matching(rollUpPatterns, nestedPattern),
      visit.matching(rollUpRegexPatterns, visit.tags('pattern')),
      visit.matching(namePatterns, visit.tags('pattern')),
      visit.matching(nameSelfPatternAnchors, patternCollection),
      visit.matching(nameAndAnnotateSelfPatterns, selfPattern),
      visit.matching(annotatePatternNode, patternNode)
    ];

    // patterns don't have to exist within Patterns
    function rollUpPatterns(node: Syntax.Pattern) {
      return node.left;
    }

    // a Regex *is* a pattern
    function rollUpRegexPatterns(node: Syntax.Pattern) {
      if ( node.left instanceof Syntax.Regex ) {
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

      function annotateSelfPattern(node: Syntax.Node) {
        annotate(node, 'pattern/self');
        return node;
      }
    }

    // all nodes inside of a Pattern should be annotated as such,
    // so that the Code Generator can branch appropriately
    function annotatePatternNode(node: Syntax.Node) {
      annotate(node, 'pattern/node');
      return node;
    }
  }
}