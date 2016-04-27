"use strict";

import Visitor from './Visitor';
import * as Syntax from './Syntax';

import { annotate, getAnnotation } from './Annotations';

interface Visitors {
  [index: string]: Function;
}

const scopeContainers = ['function', 'lambda', 'reduce', 'for', 'do'];

export default function createTreeProcessors(visit: Visitor) {
  let visitors: Visitors = {
    'function': visitFunctionDeclaration,
    'signature': visitSignature,
    'range': visitRange,
    'for': visitForStatement,
    'assignment': visitAssignment,
    'arrayDestructure': visitAssignment,
    'objectDestructure': visitAssignment,
    'let': visitExportableStatement,
    'from': visitExportableStatement,
    'import': visitExportableStatement,
    'id': visitIdentifier
  };

  let nodesToVisit = visit.tags(Object.keys(visitors));

  return [
    visit.breadthMatching(visitNode, nodesToVisit)
  ];

  function visitNode(node: Syntax.Node) {
    let visitor = visitors[node.tag];
    /* istanbul ignore if: All tags should be covered */
    if ( !visitor ) {
      throw new Error(`Stupid Coder: No Visitor for ${node.tag} Node`);
    }
    return visitor(node);
  }

  function isScopeContainer(node: Syntax.Node) {
    return scopeContainers.indexOf(node.tag) !== -1 ||
           node === visit.nodeStack[0]; // root
  }

  function isIdDeclared(id: Syntax.Identifier) {
    let nodeStack = visit.nodeStack;
    for ( let i = nodeStack.length - 1; i >= 0; i-- ) {
      let node = nodeStack[i];
      if ( node instanceof Syntax.Node && isScopeContainer(node) ) {
        let ids = getAnnotation(node, 'scope/declarations');
        if ( Array.isArray(ids) && ids.indexOf(id.value) !== -1 ) {
          return true;
        }
      }
    }
    return false;
  }

  function declareId(id: Syntax.Identifier) {
    let nodeStack = visit.nodeStack;
    for ( let i = nodeStack.length - 1; i >= 0; i-- ) {
      let node = nodeStack[i];
      if ( node instanceof Syntax.Node && isScopeContainer(node) ) {
        let ids = getAnnotation(node, 'scope/declarations') || [];
        if ( ids.indexOf(id.value) === -1 ) {
          ids.push(id.value);
          annotate(node, 'scope/declarations', ids);
        }
        return;
      }
    }

    /* istanbul ignore next: we should always find the root */
    throw new Error("Stupid Coder: No root to declare an Identifier?");
  }

  function visitFunctionDeclaration(node: Syntax.FunctionDeclaration) {
    let funcId = node.signature.id;
    if ( isIdDeclared(funcId) ) {
      annotate(node, 'function/shadow');
    }
    declareId(funcId);
    return node;
  }

  function visitSignature(node: Syntax.Signature) {
    node.params.forEach(function (param) {
      declareId(param.id);
    });
    return node;
  }

  function visitRange(node: Syntax.Range) {
    if ( node.nameId ) {
      declareId(node.nameId);
    }
    declareId(node.valueId);
    return node;
  }

  function visitForStatement(node: Syntax.ForStatement) {
    if ( node.reduceAssignments ) {
      node.reduceAssignments.forEach(function (assignment) {
        assignment.getIdentifiers().forEach(declareId);
      });
    }
    return node;
  }

  function visitAssignment(node: Syntax.Assignment) {
    node.getIdentifiers().forEach(declareId);
    return node;
  }

  function visitExportableStatement(node: Syntax.ExportableStatement) {
    node.getModuleItems().forEach(function (moduleItem) {
      declareId(moduleItem.id);
    });
    return node;
  }

  function visitIdentifier(node: Syntax.Identifier) {
    if ( !isIdDeclared(node) ) {
      visit.issueError(node, `'${node.value}' has not been declared`);
    }
    return node;
  }
}
