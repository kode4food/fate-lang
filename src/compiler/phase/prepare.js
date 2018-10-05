/** @flow */

import * as Syntax from '../syntax';
import { isArray } from '../../runtime';

const {
  Visitor, annotate, hasAnnotation, getAnnotation, Cardinality,
} = Syntax;

type FunctionOrLambda = Syntax.FunctionDeclaration | Syntax.LambdaExpression;
type AssignmentMap = { [index: string]: Syntax.Assignment };
type NameSet = { [index: string]: boolean };

const awaitBarriers = ['function', 'lambda', 'pattern', 'forExpr'];
const emitBarriers = awaitBarriers;
const whenAssigns = ['assignment', 'arrayDestructure', 'objectDestructure'];

export default function createTreeProcessors(visit: Visitor) {
  const selfFunction = visit.ancestorTags('self', ['function', 'lambda']);
  const whenReference = visit.ancestorTags('id', whenAssigns, 'let', 'do');

  return [
    visit.byTag({
      parens: rollUpParens,
      await: createBarrierValidator('do', awaitBarriers),
      emit: createBarrierValidator('generate', emitBarriers),
      self: validateSelfReferences,
      function: validateFunctionArgs,
      lambda: validateFunctionArgs,
    }),

    visit.matching(annotateSelfFunctions, selfFunction),
    visit.matching(annotateWhenReferences, whenReference),
    visit.matching(groupWhenAssignments, visit.tags('do')),
    visit.statementGroups(validateAssignments, visit.tags('let'), 1),
    visit.statements(warnFunctionShadowing),
  ];

  function rollUpParens(node: Syntax.Parens) {
    return node.left;
  }

  function createBarrierValidator(container: Syntax.Tag,
                                  barriers: Syntax.Tags) {
    return (node: Syntax.Node) => {
      const containerAncestors = visit.hasAncestorTags(container);
      const barrierAncestors = visit.hasAncestorTags(barriers);

      if (!containerAncestors) {
        visit.issueError(node,
          `${node.tag} must appear in a '${container}' block`);
      }

      if (!barrierAncestors) {
        return node;
      }

      const doIndex = visit.nodeStack.indexOf(containerAncestors[0]);
      const fnIndex = visit.nodeStack.indexOf(barrierAncestors[0]);
      if (fnIndex > doIndex) {
        visit.issueError(node,
          `${node.tag} must not appear in a nested block`);
      }
      return node;
    };
  }

  function validateSelfReferences(node: Syntax.Self) {
    if (!visit.hasAncestorTags(['function', 'lambda'])) {
      visit.issueError(node,
        "'self' keyword must appear within a Function");
    }
    return node;
  }

  function validateFunctionArgs(node: FunctionOrLambda) {
    checkParamsForDuplication(node, [node.signature]);
    checkParamCardinality(node.signature);
    return node;
  }

  function checkParamsForDuplication(node: Syntax.Node,
                                     signatures: Syntax.Signatures) {
    const encounteredNames: NameSet = {};
    const duplicatedNames: NameSet = {};
    signatures.forEach((signature) => {
      const namedParams = signature.params.filter(param => !!param.id);
      namedParams.forEach((param) => {
        const name = param.id.value;
        if (encounteredNames[name]) {
          duplicatedNames[name] = true;
          return;
        }
        encounteredNames[name] = true;
      });
    });

    const duplicatedItems = Object.keys(duplicatedNames);
    if (duplicatedItems.length) {
      visit.issueError(node,
        `Argument names are repeated in declaration: ${
        duplicatedItems.join(', ')}`);
    }
  }

  function checkParamCardinality(node: Syntax.Signature) {
    // the rules, for now: required* -> zeroToMany?
    let state = 0;
    node.params.forEach((parameter) => {
      switch (parameter.cardinality) {
        case Cardinality.Required:
          if (state !== 0) {
            visit.issueError(parameter,
              "A required argument can't follow a wildcard argument");
          }
          break;

        case Cardinality.ZeroToMany:
          if (state !== 0) {
            visit.issueError(parameter,
              "A wildcard argument can't follow a wildcard argument");
          }
          state = 1;
          break;

        default:
          throw new Error('Stupid Coder: Bad Cardinality Value');
      }
    });
  }

  function annotateSelfFunctions(node: Syntax.Self) {
    const func = visit.hasAncestorTags(['function', 'lambda'])[0];
    annotate(func, 'function/self');
    return node;
  }

  function annotateWhenReferences(node: Syntax.Identifier) {
    if (!hasAnnotation(node, 'id/reference')) {
      return node;
    }

    visit.nodeStack.forEach((parent) => {
      if (Syntax.isNode(parent) && Syntax.hasTag(parent, whenAssigns)) {
        addDoReference(parent, node);
      }
    });

    return node;
  }

  function addDoReference(node: Syntax.Assignment, id: Syntax.Identifier) {
    const ids: NameSet = getAnnotation(node, 'do/references') || {};
    ids[id.value] = true;
    annotate(node, 'do/references', ids);
  }

  function groupWhenAssignments(node: Syntax.DoExpression) {
    if (!(node.whenClause instanceof Syntax.LetStatement)) {
      return node;
    }

    const { whenClause } = node;
    const encountered: AssignmentMap = {};
    whenClause.assignments.forEach((assignment) => {
      const getters: NameSet = getAnnotation(assignment, 'do/references') || {};

      Object.keys(getters).forEach((getter) => {
        const prevAssignment = encountered[getter];
        if (!prevAssignment) {
          return;
        }

        let thisGroup = getAnnotation(assignment, 'when/group') || 0;
        const prevGroup = getAnnotation(prevAssignment, 'when/group') || 0;

        if (thisGroup <= prevGroup) {
          annotate(assignment, 'when/group', thisGroup = prevGroup + 1);
        }
      });

      assignment.getIdentifiers().forEach((id) => {
        encountered[id.value] = assignment;
      });
    });
    return node;
  }

  function validateAssignments(statements: Syntax.LetStatement[]) {
    const namesSeen: NameSet = {};
    statements.forEach((statement) => {
      statement.assignments.forEach((assignment) => {
        assignment.getIdentifiers().forEach((id) => {
          const name = id.value;
          if (namesSeen[name]) {
            visit.issueWarning(id,
              `Are you sure you wanted to immediately reassign '${name}'?`);
          }
          namesSeen[name] = true;
        });
      });
    });
    return statements;
  }

  function isGuarded(signature: Syntax.Signature) {
    if (signature.guard) {
      return true;
    }

    return signature.params.filter(
      param => param instanceof Syntax.PatternParameter,
    ).length !== 0;
  }

  function warnFunctionShadowing(statements: Syntax.Statement[]) {
    const namesSeen: NameSet = {};

    statements.forEach((statement) => {
      if (statement instanceof Syntax.FunctionDeclaration) {
        const { signature } = statement;
        const name = signature.id.value;

        if (!isGuarded(signature) && namesSeen[name]) {
          visit.issueWarning(statement,
            `The unguarded Function '${name}' will replace `
            + 'the previous definition(s)');
        }

        namesSeen[name] = true;
      }
    });
    return statements;
  }
}
