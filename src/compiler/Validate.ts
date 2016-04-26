"use strict";

import Visitor from './Visitor';
import * as Syntax from './Syntax';

export default function createTreeProcessors(visit: Visitor) {
  let nodeToCheck = visit.tags(['function', 'lambda', 'let', 'id']);

  return [
    visit.matching(validateNode, nodeToCheck)
  ];

  function validateNode(node: Syntax.Node) {
    switch ( node.tag ) {
      case 'function':
        annotateSignature((<Syntax.FunctionDeclaration>node).signature);
        break;

      case 'lambda':
        annotateSignature((<Syntax.LambdaExpression>node).signature);
        break;

      case 'let':
        annotateAssignment(<Syntax.LetStatement>node);
        break;

      case 'id':
        validateId(<Syntax.Identifier>node);
        break;

      /* istanbul ignore next: all tags should be covered */
      default:
        throw new Error("Stupid Coder: Invalid validation case");
    }

    return node;
  }

  function annotateSignature(node: Syntax.Signature) {
    return node;
  }

  function annotateAssignment(node: Syntax.LetStatement) {
    return node;
  }

  function validateId(node: Syntax.Identifier) {
    return node;
  }
}
