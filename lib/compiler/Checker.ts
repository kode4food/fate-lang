/// <reference path="../Types.ts"/>
/// <reference path="./Annotations.ts"/>
/// <reference path="./Syntax.ts"/>
/// <reference path="./Visitor.ts"/>

"use strict";

namespace Fate.Compiler.Checker {
  import isTrue = Types.isTrue;
  import isFalse = Types.isFalse;
  import isIn = Types.isIn;

  import Visitor = Compiler.Visitor;
  import Syntax = Compiler.Syntax;
  import hasTag = Syntax.hasTag;
  import isStatements = Syntax.isStatements;
  import isLiteral = Syntax.isLiteral;

  type FunctionGroups = { [index: string]: Syntax.FunctionDeclaration[] };

  export function checkSyntaxTree(syntaxTree: Syntax.Statements,
                                  warnings?: CompileErrors) {
    var visit = new Visitor(warnings);

    var pipeline = [
      visit.matching(validateWildcards, visit.tags('wildcard')),
      visit.statementGroups(mergeableFunctions, functionStatements)
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

    function functionStatements(node: Syntax.Node) {
      return (node instanceof Syntax.FunctionDeclaration) &&
             !!node.signature.id;
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
