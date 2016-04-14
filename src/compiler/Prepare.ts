"use strict";

import Visitor from './Visitor';
import * as Syntax from './Syntax';
import { annotate, hasAnnotation, getAnnotation } from './Annotations';

type FunctionOrLambda = Syntax.FunctionDeclaration|Syntax.LambdaExpression;
type AssignmentMap = { [index: string]: Syntax.Assignment };
type NameSet = { [index: string]: boolean };

const awaitBarriers = ['function', 'lambda', 'pattern'];
const assignmentTypes = ['assignment', 'arrayDestructure', 'objectDestructure'];

export default function createTreeProcessors(visit: Visitor) {
  let selfFunction = visit.ancestorTags('self', ['function', 'lambda']);
  let functionIdRetrieval = visit.ancestorTags('id', ['function']);
  let whenReference = visit.ancestorTags('id', assignmentTypes, 'let', 'do');

  return [
    visit.matching(rollUpParens, visit.tags('parens')),
    visit.matching(validateAwaits, visit.tags('await')),
    visit.matching(validateWildcards, visit.tags('wildcard')),
    visit.matching(validateSelfReferences, visit.tags('self')),
    visit.matching(validateFunctionArgs, visit.tags(['function', 'lambda'])),
    visit.matching(annotateSelfFunctions, selfFunction),
    visit.matching(annotateRecursiveFunctions, functionIdRetrieval),
    visit.matching(annotateWhenReferences, whenReference),
    visit.matching(groupWhenAssignments, visit.tags('do')),
    visit.statementGroups(validateAssignments, visit.tags('let'), 1),
    visit.statementGroups(warnFunctionShadowing, visit.tags('function'))
  ];

  function rollUpParens(node: Syntax.Parens) {
    return node.left;
  }

  // an 'await' can only exist inside of a 'do' expression
  function validateAwaits(node: Syntax.AwaitOperator) {
    let doAncestors = visit.hasAncestorTags('do');
    let fnAncestors = visit.hasAncestorTags(awaitBarriers);

    if ( !doAncestors ) {
      visit.issueError(node, "'await' must appear in a 'do' block");
    }

    if ( !fnAncestors ) {
      return node;
    }

    let doIndex = visit.nodeStack.indexOf(doAncestors[0]);
    let fnIndex = visit.nodeStack.indexOf(fnAncestors[0]);
    if ( fnIndex > doIndex ) {
      visit.issueError(node, "'await' must not appear in a nested function");
    }
    return node;
  }

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
    checkParamCardinality(node.signature);
    return node;
  }

  function checkParamsForDuplication(node: Syntax.Node,
                                     signatures: Syntax.Signatures) {
    let encounteredNames: NameSet = { };
    let duplicatedNames: NameSet = { };
    signatures.forEach(function (signature) {
      let namedParams = signature.params.filter(param => !!param.id);
      namedParams.forEach(function (param) {
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

  function checkParamCardinality(node: Syntax.Signature) {
    // the rules, for now: required* -> zeroToMany?
    let state = 0;
    node.params.forEach(function (parameter) {
      switch ( parameter.cardinality ) {
        case Syntax.Cardinality.Required:
          if ( state !== 0 ) {
            visit.issueError(parameter,
              "A required argument can't follow a wildcard argument"
            );
          }
          break;

        case Syntax.Cardinality.ZeroToMany:
          if ( state !== 0 ) {
            visit.issueError(parameter,
              "A wildcard argument can't follow a wildcard argument"
            );
          }
          state = 1;
          break;

        /* istanbul ignore next */
        default:
          throw new Error("Stupid Coder: Bad Cardinality Value");
      }
    });
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

  function annotateWhenReferences(node: Syntax.Identifier) {
    if ( !hasAnnotation(node, 'id/reference') ) {
      return node;
    }

    visit.nodeStack.forEach(function (parent) {
      if ( parent instanceof Syntax.Node &&
           Syntax.hasTag(parent, assignmentTypes) ) {
        addDoReference(<Syntax.Assignment>parent, node);
      }
    });

    return node;
  }

  function addDoReference(node: Syntax.Assignment, id: Syntax.Identifier) {
    let ids: NameSet = getAnnotation(node, 'do/references') || {};
    ids[id.value] = true;
    annotate(node, 'do/references', ids);
  }

  function groupWhenAssignments(node: Syntax.DoExpression) {
    if ( !(node.whenClause instanceof Syntax.LetStatement) ) {
      return node;
    }

    let whenClause = <Syntax.LetStatement>node.whenClause;
    let encountered: AssignmentMap = {};
    whenClause.assignments.forEach(function (assignment) {
      let getters: NameSet = getAnnotation(assignment, 'do/references') || {};

      Object.keys(getters).forEach(function (getter) {
        let prevAssignment = encountered[getter];
        if ( !prevAssignment ) {
          return;
        }

        let thisGroup = getAnnotation(assignment, 'when/group') || 0;
        let prevGroup = getAnnotation(prevAssignment, 'when/group') || 0;

        if ( thisGroup <= prevGroup ) {
          annotate(assignment, 'when/group', thisGroup = prevGroup + 1);
        }
      });

      assignment.getIdentifiers().forEach(function (id) {
        encountered[id.value] = assignment;
      });
    });
    return node;
  }

  function validateAssignments(statements: Syntax.LetStatement[]) {
    let namesSeen: NameSet = {};
    statements.forEach(function (statement) {
      statement.assignments.forEach(function (assignment) {
        assignment.getIdentifiers().forEach(function (id) {
          let name = id.value;
          if ( namesSeen[name] ) {
            visit.issueWarning(id,
              `Are you sure you wanted to immediately reassign '${name}'?`
            );
          }
          namesSeen[name] = true;
        });
      });
    });
    return statements;
  }

  function isGuarded(signature: Syntax.Signature) {
    if ( signature.guard ) {
      return true;
    }

    return signature.params.filter(function (param) {
      return param instanceof Syntax.PatternParameter;
    }).length !== 0;
  }

  function warnFunctionShadowing(statements: Syntax.FunctionDeclaration[]) {
    let namesSeen: NameSet = {};
    let lastName: string;

    statements.forEach(function (statement) {
      let signature = statement.signature;
      let name = signature.id.value;

      if ( !isGuarded(signature) && namesSeen[name] ) {
        visit.issueWarning(statement,
          `The unguarded Function '${name}' will replace ` +
          `the previous definition(s)`
        );
      }

      namesSeen[name] = true;
      lastName = name;
    });
    return statements;
  }
}
