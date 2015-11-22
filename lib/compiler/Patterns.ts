/// <reference path="../Types.ts"/>
/// <reference path="./Annotations.ts"/>
/// <reference path="./Syntax.ts"/>
/// <reference path="./Visitor.ts"/>

"use strict";

namespace Fate.Compiler.Patterns {
  let wildcardLocal = 'p';

  import Syntax = Compiler.Syntax;
  import hasTag = Syntax.hasTag;
  import annotate = Compiler.annotate;

  export function createTreeProcessors(visit: Compiler.Visitor) {
    let wildcardNumbering = 0;

    let nestedPattern = visit.ancestorTags('pattern', 'pattern');
    let patternCollection = visit.ancestorTags(['object', 'array'], 'pattern');
    let patternWildcard = visit.ancestorTags('wildcard', 'pattern');
    let patternNode = visit.ancestorTags('*', 'pattern');

    return [
      visit.matching(rollUpPatterns, nestedPattern),
      visit.matching(rollUpRegexPatterns, visit.tags('pattern')),
      visit.matching(namePatterns, visit.tags('pattern')),
      visit.matching(nameWildcardAnchors, patternCollection),
      visit.matching(nameAndAnnotateWildcards, patternWildcard),
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
        anchorName = wildcardLocal + (wildcardNumbering++);
        annotate(anchor, 'pattern/local', anchorName);
      }
      return anchorName;
    }

    function namePatterns(node: Syntax.Pattern) {
      if ( !hasAnnotation(node, 'pattern/local') ) {
        annotate(node, 'pattern/local', wildcardLocal);
      }
      let contained = node.left;
      if ( !hasTag(contained, ['object', 'array']) &&
           !hasAnnotation(contained, 'pattern/local') ) {
        annotate(contained, 'pattern/local', wildcardLocal);
      }
      return node;
    }

    function nameWildcardAnchors(node: Syntax.ElementsConstructor) {
      annotate(node, 'pattern/local', getAnchorName());
      node.elements.forEach(function (element) {
        if ( hasAnnotation(element, 'pattern/local') ) {
          return;
        }
        let elementName = wildcardLocal + (wildcardNumbering++);
        annotate(element, 'pattern/local', elementName);
      });
      return node;
    }

    // wildcard names must correspond to their element in an object or array
    function nameAndAnnotateWildcards(wildcardNode: Syntax.Wildcard) {
      if ( !hasAnnotation(wildcardNode, 'pattern/local') ) {
        annotate(wildcardNode, 'pattern/local', getAnchorName());
      }
      visit.upTreeUntilMatch(visit.tags('pattern'), annotateWildcard);
      return wildcardNode;

      function annotateWildcard(node: Syntax.Node) {
        annotate(node, 'pattern/wildcard');
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
