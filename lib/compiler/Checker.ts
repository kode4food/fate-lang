/// <reference path="./Syntax.ts"/>
/// <reference path="./Visitor.ts"/>

"use strict";

namespace Fate.Compiler.Checker {
  import Visitor = Compiler.Visitor;
  import Syntax = Compiler.Syntax;

  type FunctionOrLambda = Syntax.FunctionDeclaration|Syntax.LambdaExpression;

  export function checkSyntaxTree(syntaxTree: Syntax.Statements,
                                  warnings?: CompileErrors) {
    var visit = new Visitor(warnings);

    var pipeline = [
      visit.matching(validateWildcards, visit.tags('wildcard')),
      visit.matching(validateFunctionArgs, visit.tags(['function', 'lambda'])),
      visit.matching(validateChannelArgs, visit.tags('channel')),
      visit.statementGroups(mergeableFunctions, visit.tags('function')),
    ];

    pipeline.forEach((func) => func(syntaxTree));
    return syntaxTree;

    // A Wildcard can only exist in a pattern or call binder
    function validateWildcards(node: Syntax.Wildcard) {
      if ( !visit.hasAncestorTags(['pattern', 'bind']) ) {
        issueError(node, "Unexpected Wildcard");
      }

      var ancestors = visit.hasAncestorTags('objectAssignment', 'pattern');
      if ( ancestors ) {
        var parent = <Syntax.ObjectAssignment>ancestors[0];
        var parentIndex = visit.nodeStack.indexOf(parent);
        if ( parent.id === visit.nodeStack[parentIndex + 1] ||
             parent.id === node ) {
          issueError(node, "Wildcards cannot appear in Property Names");
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
        issueError(node,
          "Argument names are repeated in declaration: " +
          duplicatedItems.join(', ')
        );
      }
    }

    function mergeableFunctions(statements: Syntax.FunctionDeclaration[]) {
      var namesSeen: { [index: string]: boolean } = {};
      var lastName: string;
      var lastArgs: string;

      statements.forEach(function (statement) {
        var signature = statement.signature;
        var name = signature.id.value;
        var args = argumentsSignature(signature.params);

        if ( !signature.guard && namesSeen[name] ) {
          issueWarning(statement,
            "The unguarded Function '" + name + "' will replace " +
            "the previous definition(s)"
          );
        }

        if ( name === lastName && args !== lastArgs ) {
          issueWarning(statement,
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

    function issueError(source: Syntax.Node, message: string) {
      throw new CompileError(message, source.line, source.column);
    }

    function issueWarning(source: Syntax.Node, message: string) {
      warnings.push(
        new CompileError(message, source.line, source.column)
      );
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
