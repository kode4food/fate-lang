/// <reference path="./Annotations.ts"/>
/// <reference path="./Syntax.ts"/>
/// <reference path="./Visitor.ts"/>

"use strict";

namespace Fate.Compiler.Checker {
  import Syntax = Compiler.Syntax;
  import annotate = Compiler.annotate;

  type FunctionOrLambda = Syntax.FunctionDeclaration|Syntax.LambdaExpression;

  export function createTreeProcessors(visit: Compiler.Visitor) {
    let selfFunctions = visit.ancestorTags('self', ['function', 'lambda']);
    let functionIdRetrieval = visit.ancestorTags('id', ['function']);

    return [
      visit.matching(validateWildcards, visit.tags('wildcard')),
      visit.matching(validateSelfReferences, visit.tags('self')),
      visit.matching(validateFunctionArgs, visit.tags(['function', 'lambda'])),
      visit.matching(validateChannelArgs, visit.tags('channel')),
      visit.matching(annotateSelfFunctions, selfFunctions),
      visit.matching(annotateRecursiveFunctions, functionIdRetrieval),
      visit.statementGroups(validateAssignments, visit.tags('let')),
      visit.statementGroups(validateMergeables, visit.tags('function'))
    ];

    // a Wildcard can only exist in a call binder
    function validateWildcards(node: Syntax.Wildcard) {
      if ( !visit.hasAncestorTags('bind') ) {
        visit.issueError(node, "Unexpected Wildcard");
      }
      return node;
    }

    function validateSelfReferences(node: Syntax.Self) {
      if ( !visit.hasAncestorTags(['function', 'lambda', 'pattern']) ) {
        visit.issueError(node,
          "'self' keyword must appear within a Function or Pattern"
        );
      }

      let ancestors = visit.hasAncestorTags('objectAssignment', 'pattern');
      if ( ancestors ) {
        let parent = <Syntax.ObjectAssignment>ancestors[0];
        let parentIndex = visit.nodeStack.indexOf(parent);
        if ( parent.id === visit.nodeStack[parentIndex + 1] ||
             parent.id === node ) {
          visit.issueError(node,
            "'self' keyword cannot appear in a Pattern's Property Names"
          );
        }
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
      let encounteredNames: { [index: string]: boolean } = { };
      let duplicatedNames: { [index: string]: boolean } = { };
      signatures.forEach(function (signature) {
        signature.params.forEach(function (param) {
          let name = param.id.value;
          if ( encounteredNames[name] ) {
            duplicatedNames[name] = true;
            return;
          }
          encounteredNames[name] = true;
        });
      });

      let duplicatedItems = Object.keys(duplicatedNames);
      if ( duplicatedItems.length ) {
        visit.issueError(node,
          "Argument names are repeated in declaration: " +
          duplicatedItems.join(', ')
        );
      }
    }

    function annotateSelfFunctions(node: Syntax.Self) {
      if ( visit.hasAncestorTags('pattern') ) {
        return node;
      }
      let func = visit.hasAncestorTags(['function', 'lambda'])[0];
      annotate(func, 'function/self');
      annotate(func, 'no_merge');
      return node;
    }

    function annotateRecursiveFunctions(node: Syntax.Identifier) {
      let func = visit.hasAncestorTags('function')[0];
      if ( node === func.signature.id ) {
        return node;
      }
      if ( node.value !== func.signature.id.value ) {
        return node;
      }
      annotate(func, 'function/no_merge');
      return node;
    }

    function validateAssignments(statements: Syntax.LetStatement[]) {
      let namesSeen: { [index: string]: boolean } = {};
      statements.forEach(function (statement) {
        statement.assignments.forEach(function (assignment) {
          var name = assignment.id.value;
          if ( namesSeen[name] ) {
            visit.issueWarning(assignment,
              `Are you sure you wanted to immediately reassign '${name}'?`
            );
          }
          namesSeen[name] = true;
        });
      });
      return statements;
    }

    function validateMergeables(statements: Syntax.FunctionDeclaration[]) {
      let namesSeen: { [index: string]: boolean } = {};
      let lastName: string;
      let lastArgs: string;

      statements.forEach(function (statement) {
        let signature = statement.signature;
        let name = signature.id.value;
        let args = argumentsSignature(signature.params);

        if ( !signature.guard && namesSeen[name] ) {
          visit.issueWarning(statement,
            `The unguarded Function '${name}' will replace ` +
            `the previous definition(s)`
          );
        }

        if ( name === lastName && args !== lastArgs ) {
          annotate(statement, 'function/no_merge');
          visit.issueWarning(statement,
            `Reopened Function '${name}' has different ` +
            `argument names than the original definition`
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
