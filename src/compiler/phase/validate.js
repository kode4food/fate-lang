/** @flow */

import * as Syntax from '../syntax';

const {
  Visitor, annotate, getAnnotation, hasAnnotation,
} = Syntax;

const { isArray } = Array;

const scopeContainers = [
  'function', 'lambda', 'reduce', 'for', 'do', 'generate',
];

export default function createTreeProcessors(visit: Visitor) {
  const processNode = visit.breadthByTag({
    function: visitFunctionDeclaration,
    signature: visitSignature,
    range: visitRange,
    assignment: visitAssignment,
    arrayDestructure: visitAssignment,
    objectDestructure: visitAssignment,
    for: visitExportableStatement,
    let: visitExportableStatement,
    from: visitExportableStatement,
    import: visitExportableStatement,
    id: visitIdentifier,
  });

  return [processNode];

  function isScopeContainer(node: Syntax.Node) {
    return scopeContainers.indexOf(node.tag) !== -1
           || node === visit.nodeStack[0]; // root
  }

  function isIdDeclared(id: Syntax.Identifier) {
    const { nodeStack } = visit;
    for (let i = nodeStack.length - 1; i >= 0; i--) {
      const node = nodeStack[i];
      if (node instanceof Syntax.Node && isScopeContainer(node)) {
        const ids = getAnnotation(node, 'scope/declarations');
        if (isArray(ids) && ids.indexOf(id.value) !== -1) {
          return true;
        }
      }
    }
    return false;
  }

  function declareId(id: Syntax.Identifier) {
    const { nodeStack } = visit;
    for (let i = nodeStack.length - 1; i >= 0; i--) {
      const node = nodeStack[i];
      if (node instanceof Syntax.Node && isScopeContainer(node)) {
        const ids = getAnnotation(node, 'scope/declarations') || [];
        if (ids.indexOf(id.value) === -1) {
          ids.push(id.value);
          annotate(node, 'scope/declarations', ids);
        }
        return;
      }
    }
    throw new Error('Stupid Coder: No root to declare an Identifier?');
  }

  function visitFunctionDeclaration(node: Syntax.FunctionDeclaration) {
    const funcId = node.signature.id;
    if (isIdDeclared(funcId)) {
      annotate(node, 'function/shadow');
    }
    declareId(funcId);
    return node;
  }

  function visitSignature(node: Syntax.Signature) {
    node.params.forEach((param) => {
      declareId(param.id);
    });
    return node;
  }

  function visitRange(node: Syntax.Range) {
    if (node.nameId) {
      declareId(node.nameId);
    }
    declareId(node.valueId);
    return node;
  }

  function visitAssignment(node: Syntax.Assignment) {
    visit.recurseInto(node, processNode);
    node.getIdentifiers().forEach(declareId);
    return node;
  }

  function visitExportableStatement(node: Syntax.ExportableStatement) {
    visit.recurseInto(node, processNode);
    node.getModuleItems().forEach((moduleItem) => {
      declareId(moduleItem.id);
    });
    return node;
  }

  function visitIdentifier(node: Syntax.Identifier) {
    if (hasAnnotation(node, 'id/reference') && !isIdDeclared(node)) {
      visit.issueError(node, `'${node.value}' has not been declared`);
    }
    return node;
  }
}
