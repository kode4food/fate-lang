/// <reference path="../Types.ts"/>
/// <reference path="./Annotations.ts"/>
/// <reference path="./Syntax.ts"/>
/// <reference path="./Visitor.ts"/>

"use strict";

namespace Fate.Compiler.Patterns {
  var wildcardLocal = 'p';

  import isTrue = Types.isTrue;
  import isFalse = Types.isFalse;
  import isIn = Types.isIn;

  import Visitor = Compiler.Visitor;
  import Syntax = Compiler.Syntax;
  import hasTag = Syntax.hasTag;
  import isStatements = Syntax.isStatements;
  import isLiteral = Syntax.isLiteral;
  import annotate = Compiler.annotate;

  export function createTreeProcessors(visit: Compiler.Visitor) {
    var wildcardNumbering = 0;

    var nestedPattern = visit.ancestorTags('pattern', 'pattern');
    var patternCollection = visit.ancestorTags(['object', 'array'], 'pattern');
    var patternWildcard = visit.ancestorTags('wildcard', 'pattern');
    var patternNode = visit.ancestorTags('*', 'pattern');

    return [
      visit.matching(rollUpPatterns, nestedPattern),
      visit.matching(namePatterns, visit.tags('pattern')),
      visit.matching(nameWildcardAnchors, patternCollection),
      visit.matching(nameAndAnnotateWildcards, patternWildcard),
      visit.matching(annotatePatternNode, patternNode)
    ];

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
  }
}
