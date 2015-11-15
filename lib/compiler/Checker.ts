/// <reference path="./Annotations.ts"/>
/// <reference path="./Syntax.ts"/>
/// <reference path="./Visitor.ts"/>

"use strict";

namespace Fate.Compiler.Checker {
  import Visitor = Compiler.Visitor;
  import Syntax = Compiler.Syntax;
  import annotate = Compiler.annotate;

  type FunctionOrLambda = Syntax.FunctionDeclaration|Syntax.LambdaExpression;

  export function createTreeProcessors(visit: Compiler.Visitor) {
    var selfFunctions = visit.ancestorTags('self', ['function', 'lambda']);
    var functionIdRetrieval = visit.ancestorTags('id', ['function']);

    return [
      visit.matching(validateWildcards, visit.tags('wildcard')),
      visit.matching(validateSelfReferences, visit.tags('self')),
      visit.matching(validateFunctionArgs, visit.tags(['function', 'lambda'])),
      visit.matching(validateChannelArgs, visit.tags('channel')),
      visit.matching(annotateSelfFunctions, selfFunctions),
      visit.matching(annotateRecursiveFunctions, functionIdRetrieval),
      visit.statementGroups(validateMergeables, visit.tags('function'))
    ];

    // A Wildcard can only exist in a pattern or call binder
    function validateWildcards(node: Syntax.Wildcard) {
      if ( !visit.hasAncestorTags(['pattern', 'bind']) ) {
        visit.issueError(node, "Unexpected Wildcard");
      }

      var ancestors = visit.hasAncestorTags('objectAssignment', 'pattern');
      if ( ancestors ) {
        var parent = <Syntax.ObjectAssignment>ancestors[0];
        var parentIndex = visit.nodeStack.indexOf(parent);
        if ( parent.id === visit.nodeStack[parentIndex + 1] ||
             parent.id === node ) {
          visit.issueError(node,
            "Wildcards cannot appear in Property Names"
          );
        }
      }
      return node;
    }

    function validateSelfReferences(node: Syntax.Self) {
      if ( !visit.hasAncestorTags(['function', 'lambda']) ) {
        visit.issueError(node,
          "'self' keyword must appear within a Function"
        );
      }
      return node;
    }

    function validateFunctionArgs(node: FunctionOrLambda) {
      checkParamsForDuplication(node, [node.signature]);
      return node;
    }

    function validateChannelArgs(node: Syntax.ChannelDeclaration) {
      checkParamsForDuplication(node, node.signatures);
      return node;
    }

    function checkParamsForDuplication(node: Syntax.Node,
                                       signatures: Syntax.Signatures) {
      var encounteredNames: { [index: string]: boolean } = { };
      var duplicatedNames: { [index: string]: boolean } = { };
      signatures.forEach(function (signature) {
        signature.params.forEach(function (param) {
          var name = param.id.value;
          if ( encounteredNames[name] ) {
            duplicatedNames[name] = true;
            return;
          }
          encounteredNames[name] = true;
        });
      });

      var duplicatedItems = Object.keys(duplicatedNames);
      if ( duplicatedItems.length ) {
        visit.issueError(node,
          "Argument names are repeated in declaration: " +
          duplicatedItems.join(', ')
        );
      }
    }

    function annotateSelfFunctions(node: Syntax.Self) {
      var func = visit.hasAncestorTags(['function', 'lambda'])[0];
      annotate(func, 'function/self');
      annotate(func, 'no_merge');
      return node;
    }

    function annotateRecursiveFunctions(node: Syntax.Identifier) {
      var func = visit.hasAncestorTags('function')[0];
      if ( node === func.signature.id ) {
        return node;
      }
      if ( node.value !== func.signature.id.value ) {
        return node;
      }
      annotate(func, 'function/no_merge');
      return node;
    }

    function validateMergeables(statements: Syntax.FunctionDeclaration[]) {
      var namesSeen: { [index: string]: boolean } = {};
      var lastName: string;
      var lastArgs: string;

      statements.forEach(function (statement) {
        var signature = statement.signature;
        var name = signature.id.value;
        var args = argumentsSignature(signature.params);

        if ( !signature.guard && namesSeen[name] ) {
          visit.issueWarning(statement,
            "The unguarded Function '" + name + "' will replace " +
            "the previous definition(s)"
          );
        }

        if ( name === lastName && args !== lastArgs ) {
          annotate(statement, 'function/no_merge');
          visit.issueWarning(statement,
            "Reopened Function '" + name + "' has different " +
            "argument names than the original definition"
          );
        }

        namesSeen[name] = true;
        lastName = name;
        lastArgs = args;
      });
      return statements;
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
