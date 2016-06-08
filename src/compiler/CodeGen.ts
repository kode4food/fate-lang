"use strict";

import * as JavaScript from './JavaScript';
import * as Syntax from './Syntax';

import { BodyEntry } from './JavaScript';

import { hasAnnotation, getAnnotation } from './Annotations';

type FunctionMap = { [index: string]: Function };
type IdMapping = { id: string, anon: string };

const slice = Array.prototype.slice;
const likeLiteralTypes = ['string', 'number', 'boolean', 'symbol'];
const cachedPatternThreshold = 8;

/*
 * Converts a parse tree into source code (initially JavaScript). Host
 * Language-specific constructs are avoided here and instead produced
 * by JavaScript code generation module.
 */
export function generateScriptBody(parseTree: Syntax.Statements) {
  let generate = JavaScript.createModule();

  // a lookup table of code generators
  let Evaluators: FunctionMap = {
    'import': createImportEvaluator,
    'from': createFromEvaluator,
    'export': createExportEvaluator,
    'function': createFunctionEvaluator,
    'lambda': createLambdaEvaluator,
    'composeOr': createComposeOrEvaluator,
    'composeAnd': createComposeAndEvaluator,
    'reduce': createReduceEvaluator,
    'do': createDoEvaluator,
    'case': createCaseEvaluator,
    'match': createMatchEvaluator,
    'call': createCallEvaluator,
    'bind': createBindEvaluator,
    'let': createLetEvaluator,
    'assignment': createAssignmentEvaluator,
    'arrayDestructure': createAssignmentEvaluator,
    'objectDestructure': createAssignmentEvaluator,
    'return': createReturnEvaluator,
    'expression': createExpressionEvaluator,
    'arrayComp': createListCompEvaluator,
    'objectComp': createListCompEvaluator,
    'for': createForEvaluator,
    'conditional': createConditionalEvaluator,
    'if':  createIfEvaluator,
    'ifLet': createIfLetEvaluator,
    'or':  createOrEvaluator,
    'and': createAndEvaluator,
    'like': createLikeEvaluator,
    'notLike': createNotLikeEvaluator,
    'eq':  createBinaryEvaluator,
    'neq': createBinaryEvaluator,
    'in':  createInEvaluator,
    'notIn': createNotInEvaluator,
    'gt':  createBinaryEvaluator,
    'lt':  createBinaryEvaluator,
    'gte': createBinaryEvaluator,
    'lte': createBinaryEvaluator,
    'add': createBinaryEvaluator,
    'sub': createBinaryEvaluator,
    'mul': createBinaryEvaluator,
    'div': createBinaryEvaluator,
    'mod': createBinaryEvaluator,
    'not': createNotEvaluator,
    'neg': createNegEvaluator,
    'pos': createPosEvaluator,
    'await': createAwaitEvaluator,
    'format': createFormatEvaluator,
    'member': createMemberEvaluator,
    'array': createArrayEvaluator,
    'object': createObjectEvaluator,
    'id': createIdEvaluator,
    'literal': createLiteral,
    'regex': createRegex,
    'context': createContextEvaluator,
    'self': createSelfEvaluator,
    'global': createGlobalEvaluator,
    'pattern': createPatternEvaluator,
    'objectPattern': createNestedPatternEvaluator,
    'arrayPattern': createNestedPatternEvaluator
  };

  let AssignmentEvaluators: FunctionMap = {
    'assignment': createDirectAssignmentEvaluator,
    'arrayDestructure': createArrayDestructureEvaluator,
    'objectDestructure': createObjectDestructureEvaluator
  };

  // generate the module function and return the source code
  return createScriptFunction(parseTree);

  function createScriptFunction(statements: Syntax.Statements) {
    generate.func({
      internalId: generate.selfName,
      internalArgs: [generate.contextName, generate.exportsName],
      body: () => {
        createStatementsEvaluator(statements);
      }
    });
    return generate.toString();
  }

  function defer(...args: any[]) {
    let func: Function;
    if ( typeof args[0] === 'function' ) {
      func = args[0];
      args = slice.call(args, 1);
    }
    else {
      func = createEvaluator;
    }

    return () => func.apply(null, args);
  }

  /*
   * Called recursively, this is the busiest function in the code generator
   */
  function createEvaluator(node: Syntax.Node) {
    /* istanbul ignore if: untestable */
    if ( !(node instanceof Syntax.Node) ) {
      throw new Error("Stupid Coder: createEvaluator called without a Node");
    }

    let nodeType = node.tag;
    let createFunction = Evaluators[nodeType];

    /* istanbul ignore if: untestable */
    if ( !createFunction ) {
      throw new Error(`Stupid Coder: Invalid tag in Node: ${nodeType}`);
    }

    createFunction(node);
  }

  function createBinaryEvaluator(node: Syntax.BinaryOperator) {
    generate.binaryOperator(node.tag, defer(node.left), defer(node.right));
  }

  function createStatementsEvaluator(node: Syntax.Statements) {
    node.statements.forEach(createEvaluator);
  }

  function createImportEvaluator(node: Syntax.ImportStatement) {
    let assigns: JavaScript.AssignmentItems = [];
    node.modules.forEach(module => {
      let moduleName = module.path.value;
      let moduleAlias = module.alias.value;

      let moduleNameId = generate.literal(moduleName);
      let importer = generate.builder('importer', moduleNameId);

      assigns.push([
        moduleAlias,
        () => {
          generate.call(importer, [createImporterArguments]);
        }
      ]);
    });
    generate.assignments(assigns);
  }

  function createImporterArguments() {
    generate.member(
      () => { generate.context(); },
      generate.currentDirectory()
    );
  }

  function createFromEvaluator(node: Syntax.FromStatement) {
    let assigns: any[] = [];
    let modulePath = node.path.value;
    let modulePathId = generate.literal(modulePath);
    let importer = generate.builder('importer', modulePathId);

    let anon = generate.createAnonymous();
    assigns.push([
      anon,
      () => {
        generate.call(importer, [createImporterArguments]);
      }
    ]);

    node.importList.forEach(item => {
      assigns.push([
        item.id.value,
        () => {
          generate.member(
            () => {
              generate.retrieveAnonymous(anon);
            },
            generate.literal(item.moduleKey.value)
          );
        }
      ]);
    });

    generate.assignments(assigns);
  }

  function createExportEvaluator(node: Syntax.ExportStatement) {
    let exports = node.exportItems.map(item => {
      let name = item.id.value;
      let alias = item.moduleKey.value;
      return <JavaScript.ModuleItem>[name, alias];
    });

    generate.exports(exports);
  }

  function getFuncOrLambdaInternalId(node: Syntax.Node) {
    let hasSelf = hasAnnotation(node, 'function/self');
    return hasSelf ? generate.selfName : undefined;
  }

  function createFunctionEvaluator(node: Syntax.FunctionDeclaration) {
    let signature = node.signature;
    let params = signature.params;
    let paramNames = getFixedParamNames(params);

    let create = signature.guard ? createGuarded : createUnguarded;
    create();

    function createUnguarded() {
      let functionName = node.signature.id;
      generate.funcDeclaration(functionName.value, {
        internalId: getFuncOrLambdaInternalId(node),
        contextArgs: paramNames,
        body: createBody
      });

      function createBody() {
        generateParamProcessor(params);
        createStatementsEvaluator(node.statements);
      }
    }

    function createGuarded() {
      let functionName = node.signature.id;
      let ensured = generateEnsured(functionName);

      generate.funcDeclaration(functionName.value, {
        internalId: getFuncOrLambdaInternalId(node),
        contextArgs: paramNames,
        body: createBody
      });

      function createBody() {
        generateParamProcessor(params);
        generate.ifStatement(
          defer(signature.guard),
          null,  // this is an 'else' case
          () => {
            generate.returnStatement(() => {
              generate.call(ensured);
            });
          }
        );
        createStatementsEvaluator(node.statements);
      }
    }

    function generateEnsured(functionName: Syntax.Identifier): BodyEntry {
      if ( !hasAnnotation(node, 'function/shadow') ) {
        return generate.runtimeImport('functionNotExhaustive');
      }

      let ensure = generate.runtimeImport('ensureFunction');
      let ensuredId = generate.createAnonymous();

      generate.statement(() => {
        generate.assignAnonymous(ensuredId, () => {
          generate.call(ensure, [() => {
            generate.getter(functionName.value);
          }]);
        });
      });

      return () => {
        generate.retrieveAnonymous(ensuredId);
      };
    }
  }

  function createLambdaEvaluator(node: Syntax.LambdaExpression) {
    let signature = node.signature;
    let params = signature.params;
    let paramNames = getFixedParamNames(params);

    generate.parens(() => {
      generate.func({
        internalId: getFuncOrLambdaInternalId(node),
        contextArgs: paramNames,
        body: createBody
      });
    });

    function createBody() {
      generateParamProcessor(params);
      createStatementsEvaluator(node.statements);
    }
  }

  function getFixedParamNames(params: Syntax.Parameters) {
    let isFixed = true;
    return params.filter(param => {
      isFixed = isFixed && param.cardinality === Syntax.Cardinality.Required;
      return isFixed;
    }).map(param => param.id.value);
  }

  function generateParamProcessor(params: Syntax.Parameters) {
    let fixedCount = getFixedParamNames(params).length;
    if ( fixedCount === params.length ) {
      return;
    }

    let nonFixed = params.slice(fixedCount);
    nonFixed.forEach((param, idx) => {
      /* istanbul ignore if: untestable */
      if ( param.cardinality !== Syntax.Cardinality.ZeroToMany ) {
        throw new Error("Stupid Coder: Unexpected cardinality");
      }

      generate.assignment(
        param.id.value,
        () => { generate.args(fixedCount); }
      );
    });
  }

  function createComposeOrEvaluator(node: Syntax.ComposeOrExpression) {
    generate.call(
      generate.runtimeImport('composeOr'),
      [() => { generate.array(node.expressions.map(defer)); }]
    );
  }

  function createComposeAndEvaluator(node: Syntax.ComposeAndExpression) {
    generate.call(
      generate.runtimeImport('composeAnd'),
      [() => { generate.array(node.expressions.map(defer)); }]
    );
  }

  function createReduceEvaluator(node: Syntax.ReduceExpression) {
    let statements = node.template('statements', [
      node.template('assignment', node.assignment.id, node.select)
    ]);
    let forNode = node.template('for',
      node.ranges,
      statements,
      node.template('statements', []),
      [node.assignment]
    );

    let isSingle = hasAnnotation(node, 'function/single_expression');
    let bodyGenerator = isSingle ? generate.scope : generate.iife;
    bodyGenerator(() => {
      createForEvaluator(forNode);
    });
  }

  function createDoEvaluator(node: Syntax.DoExpression,
                             caseGuard?: Function) {
    generate.call(generate.runtimeImport('createDoBlock'), [
      () => {
        generate.func({
          generator: true,
          body: doBody
        });
      }
    ]);

    function doBody() {
      if ( node.whenClause instanceof Syntax.LetStatement ) {
        let whenClause = <Syntax.LetStatement>node.whenClause;
        let groups = getAssignmentGroups(whenClause.assignments);
        groups.forEach(generateAssignment);
      }
      else if ( node.whenClause ) {
        generateExpression(node.whenClause);
      }

      if ( caseGuard ) {
        caseGuard();
      }
      createStatementsEvaluator(node.statements);
    }

    function generateExpression(expression: Syntax.Expression) {
      generate.statement(() => {
        generate.assignResult(() => {
          generate.waitFor(Syntax.Resolver.Value, () => {
            createEvaluator(expression);
          });
        });
      });
    }

    function generateAssignment(group: Syntax.Assignments) {
      let anon = generate.createAnonymous();
      generate.statement(() => {
        generate.assignAnonymous(anon, () => {
          generate.waitFor(Syntax.Resolver.All, () => {
            generate.array(
              group.map(assignment => defer(assignment.value))
            );
          });
        });
      });

      group.forEach((assignment, index) => {
        createAssignmentEvaluator(assignment, () => {
          return () => {
            generate.member(
              () => { generate.retrieveAnonymous(anon); },
              generate.literal(index)
            );
          };
        });
      });
    }

    function getAssignmentGroups(assignments: Syntax.Assignments) {
      let groups: Syntax.Assignments[] = [];

      assignments.forEach(assignment => {
        let groupNum = getAnnotation(assignment, 'when/group') || 0;
        let group = groups[groupNum] || (groups[groupNum] = []);
        group.push(assignment);
      });

      return groups;
    }
  }

  function createCaseEvaluator(node: Syntax.CaseExpression) {
    generate.call(generate.runtimeImport('createDoBlock'), [
      () => {
        generate.func({
          generator: true,
          body: doBody
        });
      }
    ]);

    function doBody() {
      let triggered = generate.createAnonymous();

      generate.returnStatement(() => {
        generate.waitFor(Syntax.Resolver.Any, () => {
          generate.array(node.cases.map(
            doCase => () => {
              createDoEvaluator(doCase, () => {
                generate.ifStatement(
                  () => { generate.retrieveAnonymous(triggered); },
                  () => { generate.returnStatement(); },
                  null
                );

                generate.statement(() => {
                  generate.assignAnonymous(
                    triggered, generate.literal(true)
                  );
                });
              });
            }
          ));
        });
      });
    }
  }

  function createMatchEvaluator(node: Syntax.MatchExpression) {
    let generator = node.value ? generateExpression : generateFunction;
    generator();

    function generateExpression() {
      generate.iife(() => {
        generateBody(defer(node.value));
      });
    }

    function generateFunction() {
      generate.parens(() => {
        generate.func({
          internalArgs: [generate.valueName],
          body: () => {
            generateBody(generate.valueName);
          }
        });
      });
    }

    function generateBody(valueGenerator: BodyEntry) {
      let value = generate.createAnonymous();
      generate.statement(() => {
        generate.assignAnonymous(value, valueGenerator);
      });

      node.matches.forEach(match => {
        generate.ifStatement(
          () => {
            createLikeComparison(
              () => { generate.retrieveAnonymous(value); },
              defer(match.pattern)
            );
          },
          () => {
            createStatementsEvaluator(match.statements);
            generate.returnStatement();
          },
          null
        );
      });

      if ( node.elseStatements.isEmpty() ) {
        let exploder = generate.runtimeImport('matchNotExhaustive');
        generate.statement(() => {
          generate.call(exploder, []);
        });
        return;
      }

      createStatementsEvaluator(node.elseStatements);
    }
  }

  function createCallEvaluator(node: Syntax.CallOperator) {
    generate.call(
      defer(node.left),
      node.right.map(argNode => defer(argNode))
    );
  }

  function createBindEvaluator(node: Syntax.BindOperator) {
    generate.call(generate.runtimeImport('bindFunction'), [
      defer(node.left),
      () => {
        let elems: JavaScript.ObjectAssignmentItems = [];
        node.right.forEach((argNode, index) => {
          if ( argNode instanceof Syntax.Wildcard ) {
            return;
          }
          elems.push([
            generate.literal(index), <Function>defer(argNode), false
          ]);
        });
        generate.object(elems);
      }
    ]);
  }

  function createLetEvaluator(node: Syntax.LetStatement) {
    node.assignments.forEach(createEvaluator);
  }

  function getAssignmentValue(node: Syntax.Assignment) {
    return defer(node.value);
  }

  function createAssignmentEvaluator(node: Syntax.Assignment,
                                     getValue = getAssignmentValue) {
    let assignmentEvaluator = AssignmentEvaluators[node.tag];
    return assignmentEvaluator(node, getValue);
  }

  function createDirectAssignmentEvaluator(node: Syntax.DirectAssignment,
                                           getValue: Function) {
    generate.assignment(node.id.value, getValue(node));
  }

  function createArrayDestructureEvaluator(node: Syntax.ArrayDestructure,
                                           getValue: Function) {
    let result = generate.createAnonymous();

    generate.statement(() => {
      generate.assignAnonymous(result, getValue(node));
    });

    node.getIdentifiers().forEach((id, index) => {
      if ( id instanceof Syntax.Wildcard ) {
        return;
      }
      generate.assignment(id.value, () => {
        generate.member(
          () => { generate.retrieveAnonymous(result); },
          generate.literal(index)
        );
      });
    });
  }

  function createObjectDestructureEvaluator(node: Syntax.ObjectDestructure,
                                            getValue: Function) {
    let result = generate.createAnonymous();

    generate.statement(() => {
      generate.assignAnonymous(result, getValue(node));
    });

    node.items.forEach(item => {
      generate.assignment(item.id.value, () => {
        generate.member(
          () => { generate.retrieveAnonymous(result); },
          defer(item.value)
        );
      });
    });
  }

  function createReturnEvaluator(node: Syntax.ReturnStatement) {
    generate.returnStatement(defer(node.result));
  }

  // generate an evaluator that assigns the result of an expression
  // to the last result scratch variable
  function createExpressionEvaluator(node: Syntax.ExpressionStatement) {
    generate.statement(() => {
      generate.assignResult(defer(node.expression));
    });
  }

  function createListCompEvaluator(node: Syntax.ListComprehension) {
    let isSingle = hasAnnotation(node, 'function/single_expression');
    let bodyGenerator = isSingle ? generate.scope : generate.iife;
    bodyGenerator(functionWrapperBody);

    function functionWrapperBody() {
      let isObject = node instanceof Syntax.ObjectComprehension;
      let genContainer = isObject ? generate.object : generate.array;
      let createBody = isObject ? createNameValueBody : createValueBody;
      let result = generate.createAnonymous();

      generate.statement(() => {
        generate.assignAnonymous(result, () => {
          (<Function>genContainer)([]);
        });
      });

      createLoop(node.ranges, createBody);
      generate.statement(() => {
        generate.assignResult(() => {
          generate.retrieveAnonymous(result);
        });
      });

      function createValueBody() {
        let arrayCompNode = <Syntax.ArrayComprehension>node;
        generate.statement(() => {
          generate.arrayAppend(result, defer(arrayCompNode.value));
        });
      }

      function createNameValueBody() {
        let objectCompNode = <Syntax.ObjectComprehension>node;
        let assign = objectCompNode.assignment;
        generate.statement(() => {
          generate.objectAssign(
            result, defer(assign.id), defer(assign.value)
          );
        });
      }
    }
  }

  function createForEvaluator(node: Syntax.ForStatement) {
    let generateLoop: Function, generateBody: Function;
    let idMappings: IdMapping[];
    let reduceAssignments = node.reduceAssignments;

    if ( reduceAssignments ) {
      generateLoop = generateReduceLoop;
      generateBody = generateReduceBody;
    }
    else {
      generateLoop = generateForLoop;
      generateBody = generateForBody;
    }

    generateStatements();
    if ( reduceAssignments ) {
      generateReduceResult();
    }

    function generateStatements() {
      let elseStatements = node.elseStatements;
      if ( elseStatements.isEmpty() ) {
        return generateLoop();
      }

      let successVar = generate.createAnonymous();
      generate.assignment(successVar, generate.literal(false));
      generateLoop(successVar);
      generate.ifStatement(
        () => { generate.retrieveAnonymous(successVar); },
        null,
        defer(createStatementsEvaluator, elseStatements)
      );
    }

    function generateReduceResult() {
      generate.statement(() => {
        generate.assignResult(() => {
          let ids = node.getReduceIdentifiers();
          if ( ids.length === 1 ) {
            generate.getter(ids[0].value);
            return;
          }
          generate.array(ids.map(
            id => () => { generate.getter(id.value); }
          ));
        });
      });
    }

    function generateReduceInitializers() {
      reduceAssignments.forEach(createEvaluator);
    }

    function createAnonymousCounters() {
      idMappings = node.getReduceIdentifiers().map(id => {
        return {
          id: id.value,
          anon: generate.createAnonymous()
        };
      });
    }

    function generateResultAssignments() {
      idMappings.forEach(mapping => {
        generate.assignment(mapping.id, () => {
          generate.retrieveAnonymous(mapping.anon);
        });
      });
    }

    function generateAnonymousAssignments() {
      idMappings.forEach(mapping => {
        generate.statement(() => {
          generate.assignAnonymous(mapping.anon, () => {
            generate.getter(mapping.id);
          });
        });
      });
    }

    function generateReduceLoop(successVar?: string) {
      generateReduceInitializers();
      createAnonymousCounters();
      generateAnonymousAssignments();
      generateForLoop(successVar);
      generateResultAssignments();
    }

    function generateForLoop(successVar?: string) {
      generate.statement(() => {
        createLoop(node.ranges, generateBody, successVar);
      });
    }

    function generateReduceBody() {
      generateResultAssignments();
      generateForBody();
      generateAnonymousAssignments();
    }

    function generateForBody() {
      createStatementsEvaluator(node.loopStatements);
    }
  }

  function createLoop(ranges: Syntax.Ranges, createBody: Function,
                      successVar?: string) {
    processRange(0);

    function processRange(i: number) {
      if ( i === ranges.length ) {
        if ( successVar ) {
          generate.statement(() => {
            generate.assignAnonymous(successVar, generate.literal(true));
          });
        }
        createBody();
        return;
      }

      let range = ranges[i];
      let valueId = range.valueId.value;
      let nameId = range.nameId ? range.nameId.value : null;
      let guardFunc: Function;

      if ( range.guard ) {
        // we have a guard
        guardFunc = () => {
          generate.ifStatement(
            defer(range.guard),
            null,
            () => { generate.loopContinue(); }
          );
        };
      }

      if ( i === 0 ) {
        genLoopExpression();
      }
      else {
        generate.statement(genLoopExpression);
      }

      function genLoopExpression() {
        generate.loopExpression({
          value: valueId,
          name: nameId,
          collection: defer(range.collection),
          guard: guardFunc,
          body: () => {
            processRange(i + 1);
          }
        });
      }
    }
  }

  function createConditionalEvaluator(node: Syntax.ConditionalOperator) {
    generate.conditionalOperator(
      defer(node.condition),
      defer(node.trueResult),
      defer(node.falseResult)
    );
  }

  function createIfEvaluator(node: Syntax.IfStatement) {
    generateIf(
      defer(node.condition),
      node.thenStatements,
      node.elseStatements
    );
  }

  function createIfLetEvaluator(node: Syntax.IfLetStatement) {
    let some = generate.runtimeImport('isSomething');
    let letStatement = node.condition;
    createLetEvaluator(letStatement);

    let assignments = letStatement.assignments;
    let conditions: string[] = [];
    assignments.forEach(assignment => {
      assignment.getIdentifiers().forEach(id => {
        conditions.push(generate.code(() => {
          generate.call(some, [() => {
            generate.getter(id.value);
          }]);
        }));
      });
    });

    generateIf(
      () => { generate.writeAndGroup(conditions); },
      node.thenStatements,
      node.elseStatements
    );
  }

  function generateIf(condition: Function,
                      thenStatements: Syntax.Statements,
                      elseStatements: Syntax.Statements) {
    let thens = thenStatements.isEmpty() ? null : thenStatements;
    let elses = elseStatements.isEmpty() ? null : elseStatements;

    generate.ifStatement(
      condition,
      thens ? defer(createStatementsEvaluator, thens) : null,
      elses ? defer(createStatementsEvaluator, elses) : null
    );
  }

  function createOrEvaluator(node: Syntax.OrOperator) {
    let leftAnon = generate.createAnonymous();
    generate.compoundExpression([
      () => {
        generate.assignAnonymous(leftAnon, defer(node.left));
      },
      () => {
        generate.conditionalOperator(
          leftAnon,
          leftAnon,
          defer(node.right)
        );
      }
    ]);
  }

  function createAndEvaluator(node: Syntax.AndOperator) {
    let leftAnon = generate.createAnonymous();
    generate.compoundExpression([
      () => {
        generate.assignAnonymous(leftAnon, defer(node.left));
      },
      () => {
        generate.conditionalOperator(
          leftAnon,
          defer(node.right),
          leftAnon
        );
      }
    ]);
  }

  function createLikeEvaluator(node: Syntax.LikeOperator) {
    createLikeComparison(node.left, node.right);
  }

  function createNotLikeEvaluator(node: Syntax.NotLikeOperator) {
    generate.unaryOperator('not', () => {
      createLikeComparison(node.left, node.right);
    });
  }

  function createInEvaluator(node: Syntax.InOperator) {
    let isIn = generate.runtimeImport('isIn');
    generate.call(isIn, [defer(node.left), defer(node.right)]);
  }

  function createNotInEvaluator(node: Syntax.NotInOperator) {
    generate.unaryOperator('not', () => {
      let isIn = generate.runtimeImport('isIn');
      generate.call(isIn, [defer(node.left), defer(node.right)]);
    });
  }

  function createNotEvaluator(node: Syntax.NotOperator) {
    generate.unaryOperator('not', () => {
      let isTrue = generate.runtimeImport('isTrue');
      generate.call(isTrue, [defer(node.left)]);
    });
  }

  function createNegEvaluator(node: Syntax.NegativeOperator) {
    generate.unaryOperator('neg', defer(node.left));
  }

  function createPosEvaluator(node: Syntax.PositiveOperator) {
    generate.unaryOperator('pos', defer(node.left));
  }

  function createAwaitEvaluator(node: Syntax.AwaitOperator) {
    generate.waitFor(node.resolver, defer(node.left));
  }

  function createFormatEvaluator(node: Syntax.FormatOperator) {
    let formatStr = generate.literal((<Syntax.Literal>node.left).value);
    let formatter = generate.builder('buildFormatter', formatStr);
    generate.write(formatter);
  }

  function createMemberEvaluator(node: Syntax.MemberOperator) {
    generate.member(defer(node.left), defer(node.right));
  }

  function createArrayEvaluator(node: Syntax.ArrayConstructor) {
    generate.array(node.elements.map(defer));
  }

  function createObjectEvaluator(node: Syntax.ObjectConstructor) {
    let elems = node.elements.map(elem => {
      let name: BodyEntry;
      if ( elem.id instanceof Syntax.Literal ) {
        name = (<Syntax.Literal>elem.id).value;
      }
      else {
        name = defer(elem.id);
      }
      return [name, defer(elem.value), false];
    });
    generate.object(<JavaScript.ObjectAssignmentItems>elems);
  }

  function createIdEvaluator(id: Syntax.Identifier) {
    generate.getter(id.value);
  }

  function createLiteral(node: Syntax.Literal) {
    let literal = generate.literal(node.value);
    generate.write(literal);
  }

  function createRegex(node: Syntax.Regex) {
    let regex = generate.builder('defineRegexPattern',
                                 generate.literal(node.value));
    generate.write(regex);
  }

  function createContextEvaluator(node: Syntax.Context) {
    let contextName = getAnnotation(node, 'pattern/local');
    /* istanbul ignore next: shouldn't happen */
    if ( !contextName ) {
      throw new Error("Stupid Coder: Where's the context pattern name?");
    }
    contextName = generate.registerAnonymous(contextName);
    generate.retrieveAnonymous(contextName);
  }

  function createSelfEvaluator(node: Syntax.Self) {
    generate.self();
  }

  function createGlobalEvaluator(node: Syntax.Global) {
    generate.context();
  }

  function getPatternDefineMethodName(node: Syntax.Pattern) {
    let complexity = getAnnotation(node, 'pattern/complexity');
    return complexity > cachedPatternThreshold ? 'defineCachedPattern'
                                               : 'definePattern';
  }

  function createPatternEvaluator(node: Syntax.Pattern) {
    let defineName = getPatternDefineMethodName(node);
    let definePattern = generate.runtimeImport(defineName);
    generate.call(definePattern, [
      () => {
        generate.func({
          internalArgs: [getAnnotation(node, 'pattern/local')],
          body: patternBody
        });
      }
    ]);

    function patternBody() {
      generate.returnStatement(() => {
        createPatternTemplate(node.left);
      });
    }
  }

  function createPatternTemplate(node: Syntax.Node) {
    switch ( node.tag ) {
      case 'objectPattern':
      case 'arrayPattern':
        createNestedPatternEvaluator(<Syntax.CollectionPattern>node);
        break;
      case 'context':
        generate.write(generate.literal(true));
        break;
      default:
        if ( hasAnnotation(node, 'pattern/equality') ) {
          createLikeComparison(
            () => {
              let localName = getAnnotation(node, 'pattern/local');
              localName = generate.registerAnonymous(localName);
              generate.retrieveAnonymous(localName);
            },
            node
          );
          return;
        }
        generate.write(defer(node));
    }
  }

  function createNestedPatternEvaluator(node: Syntax.CollectionPattern) {
    let parentLocal = getAnnotation(node, 'pattern/local');
    parentLocal = generate.registerAnonymous(parentLocal);

    let isObject = node instanceof Syntax.ObjectPattern;
    let containerCheckName = isObject ? 'isObject' : 'isArray';

    let expressions: Function[] = [];
    expressions.push(() => {
      let checker = generate.runtimeImport(containerCheckName);
      generate.call(checker, [() => {
        generate.retrieveAnonymous(parentLocal);
      }]);
    });

    node.elements.forEach(element => {
      if ( element instanceof Syntax.PatternElement ) {
        pushElement(element);
      }
      else {
        expressions.push(defer(element));
      }
    });
    generate.writeAndGroup(expressions);

    function pushElement(element: Syntax.PatternElement) {
      if ( element.value instanceof Syntax.Wildcard ) {
        return;
      }

      if ( hasAnnotation(element.value, 'pattern/equality') ) {
        expressions.push(generateEquality(element.value, defer(element.id)));
        return;
      }

      expressions.push(
        generateNested(element, element.value, defer(element.id))
      );
    }

    function generateEquality(elementValue: Syntax.Node,
                              elementIndex: BodyEntry) {
      if ( elementValue instanceof Syntax.Literal ) {
        return () => {
          createLikeComparison(value, elementValue);
        };
      }
      return () => {
        createLikeComparison(
          value, defer(elementValue, createPatternTemplate)
        );
      };

      function value() {
        generate.member(
          () => { generate.retrieveAnonymous(parentLocal); },
          elementIndex
        );
      }
    }

    function generateNested(element: Syntax.Node, elementValue: Syntax.Node,
                            elementIndex: BodyEntry) {
      let elementLocal = getAnnotation(element, 'pattern/local');
      elementLocal = generate.registerAnonymous(elementLocal);

      return () => {
        generate.compoundExpression([
          () => {
            generate.assignAnonymous(
              elementLocal,
              () => {
                generate.member(
                  () => { generate.retrieveAnonymous(parentLocal); },
                  elementIndex
                );
              }
            );
          },
          defer(elementValue, createPatternTemplate)
        ]);
      };
    }
  }

  function createLikeComparison(leftNode: Syntax.Node|Function,
                                rightNode: Syntax.Node|Function) {
    let left = deferIfNotAlready(leftNode);
    let right = deferIfNotAlready(rightNode);

    if ( !(rightNode instanceof Syntax.Literal) ) {
      let isMatch = generate.runtimeImport('isMatch');
      generate.call(isMatch, [right, left]);
      return;
    }

    if ( isLikeLiteral(rightNode) ) {
      generate.binaryOperator('eq', left, right);
      return;
    }

    let matcher = generate.builder('buildMatcher', generate.code(right));
    generate.call(matcher, [left]);
  }

  function deferIfNotAlready(node: Syntax.Node|Function) {
    return typeof node === 'function' ? <Function>node : defer(node);
  }

  function isLikeLiteral(node: Syntax.Node|Function) {
    let valueType = typeof (<Syntax.Literal>node).value;
    return likeLiteralTypes.indexOf(valueType) !== -1;
  }
}
