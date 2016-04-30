"use strict";

import Visitor from './Visitor';
import * as Syntax from './Syntax';

import { annotate, getAnnotation, hasAnnotation } from './Annotations';

interface Visitors {
  [index: string]: Function;
}

const scopeContainers = ['function', 'lambda', 'reduce', 'for', 'do'];

export default function createTreeProcessors(visit: Visitor) {
  let visitors: Visitors = {
    'function': visitFunctionDeclaration,
    'signature': visitSignature,
    'range': visitRange,
    'assignment': visitAssignment,
    'arrayDestructure': visitAssignment,
    'objectDestructure': visitAssignment,
    'for': visitExportableStatement,
    'let': visitExportableStatement,
    'from': visitExportableStatement,
    'import': visitExportableStatement,
    'id': visitIdentifier
  };

  let nodesToVisit = visit.tags(Object.keys(visitors));
  let processNode = visit.breadthMatching(visitNode, nodesToVisit);

  return [processNode];

  function visitNode(node: Syntax.Node) {
    return visitors[node.tag](node);
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

  function visitAssignment(node: Syntax.Assignment) {
    visit.recurseInto(node, processNode); // Children first
    node.getIdentifiers().forEach(declareId);
    return node;
  }

  function visitExportableStatement(node: Syntax.ExportableStatement) {
    visit.recurseInto(node, processNode); // Children first
    node.getModuleItems().forEach(function (moduleItem) {
      declareId(moduleItem.id);
    });
    return node;
  }

  function visitIdentifier(node: Syntax.Identifier) {
    if ( hasAnnotation(node, 'id/reference') && !isIdDeclared(node) ) {
      visit.issueError(node, `'${node.value}' has not been declared`);
    }
    return node;
  }
}
