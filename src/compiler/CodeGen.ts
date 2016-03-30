"use strict";

import * as JavaScript from './JavaScript';
import * as Syntax from './Syntax';

import { hasAnnotation, getAnnotation } from './Annotations';

type FunctionMap = { [index: string]: Function };
type IdMapping = { id: string, anon: string };

const slice = Array.prototype.slice;
const likeLiteralTypes = ['string', 'number', 'boolean', 'symbol'];

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
    'self': createSelfEvaluator,
    'pattern': createPatternEvaluator
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
      body: function () {
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

    return function () {
      return func.apply(null, args);
    };
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
    node.modules.forEach(function (module: Syntax.ModuleSpecifier) {
      let moduleName = module.path.value;
      let moduleAlias = module.alias.value;

      let moduleNameId = generate.literal(moduleName);
      let importer = generate.builder('importer', moduleNameId);

      assigns.push([
        moduleAlias,
        function () {
          generate.call(importer, [createImporterArguments]);
        }
      ]);
    });
    generate.assignments(assigns);
  }

  function createImporterArguments() {
    generate.member(
      function () { generate.context(); },
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
      function () {
        generate.call(importer, [createImporterArguments]);
      }
    ]);

    node.importList.forEach(function (item: Syntax.ModuleItem) {
      assigns.push([
        item.alias.value,
        function () {
          generate.member(
            function () {
              generate.retrieveAnonymous(anon);
            },
            generate.literal(item.name.value)
          );
        }
      ]);
    });

    generate.assignments(assigns);
  }

  function createExportEvaluator(node: Syntax.ExportStatement) {
    let exports = node.exportItems.map(function (item: Syntax.ModuleItem) {
      let name = item.name.value;
      let alias = item.alias.value;
      return <JavaScript.ModuleItem>[name, alias];
    });

    generate.exports(exports);
  }

  function getFuncOrLambdaInternalId(node: Syntax.Node) {
    let hasSelf = hasAnnotation(node, 'function/self');
    return hasSelf ? generate.selfName : undefined;
  }

  function generateEnsured(signatureName: Syntax.Identifier,
                           signatureType: string) {
    let ensure = generate.runtimeImport('ensure' + signatureType);
    let ensuredId = generate.createAnonymous();

    generate.statement(function () {
      generate.assignAnonymous(ensuredId, function () {
        generate.call(ensure, [function () {
          generate.getter(signatureName.value);
        }]);
      });
    });

    return ensuredId;
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
      let ensuredId = generateEnsured(functionName, 'Function');

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
          function () {
            generate.returnStatement(function () {
              generate.call(ensuredId);
            });
          }
        );
        createStatementsEvaluator(node.statements);
      }
    }
  }

  function createLambdaEvaluator(node: Syntax.LambdaExpression) {
    let signature = node.signature;
    let params = signature.params;
    let paramNames = getFixedParamNames(params);

    generate.parens(function () {
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
    return params.filter(function (param: Syntax.Parameter) {
      isFixed = isFixed && param.cardinality === Syntax.Cardinality.Required;
      return isFixed;
    }).map(function (param: Syntax.Parameter) {
      return param.id.value;
    });
  }

  function generateParamProcessor(params: Syntax.Parameters) {
    let fixedCount = getFixedParamNames(params).length;
    if ( fixedCount === params.length ) {
      return;
    }

    let nonFixed = params.slice(fixedCount);
    nonFixed.forEach(function (param: Syntax.Parameter, idx: number) {
      /* istanbul ignore if: untestable */
      if ( param.cardinality !== Syntax.Cardinality.ZeroToMany ) {
        throw new Error("Stupid Coder: Unexpected cardinality");
      }

      generate.assignment(
        param.id.value,
        function () { generate.args(fixedCount); }
      );
    });
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
    bodyGenerator(function () {
      createForEvaluator(forNode);
    });
  }

  function createDoEvaluator(node: Syntax.DoExpression,
                             caseGuard?: Function) {
    generate.call(generate.runtimeImport('createDoBlock'), [
      function () {
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
      generate.statement(function () {
        generate.assignResult(function () {
          generate.waitFor(Syntax.Resolver.Value, function () {
            createEvaluator(expression);
          });
        });
      });
    }

    function generateAssignment(group: Syntax.Assignments) {
      let anon = generate.createAnonymous();
      generate.statement(function () {
        generate.assignAnonymous(anon, function () {
          generate.waitFor(Syntax.Resolver.All, function () {
            generate.array(
              group.map(function (assignment) {
                return defer(assignment.value);
              })
            );
          });
        });
      });

      group.forEach(function (assignment, idx) {
        createAssignmentEvaluator(assignment, function () {
          return function () {
            generate.member(
              function () { generate.retrieveAnonymous(anon); },
              '' + idx
            );
          };
        });
      });
    }

    function getAssignmentGroups(assignments: Syntax.Assignments) {
      let groups: Syntax.Assignments[] = [];

      assignments.forEach(function (assignment) {
        let groupNum = getAnnotation(assignment, 'when/group') || 0;
        let group = groups[groupNum] || (groups[groupNum] = []);
        group.push(assignment);
      });

      return groups;
    }
  }

  function createCaseEvaluator(node: Syntax.CaseExpression) {
    generate.call(generate.runtimeImport('createDoBlock'), [
      function () {
        generate.func({
          generator: true,
          body: doBody
        });
      }
    ]);

    function doBody() {
      let triggered = generate.createAnonymous();

      generate.returnStatement(function () {
        generate.waitFor(Syntax.Resolver.Any, function () {
          generate.array(node.cases.map(function (doCase) {
            return function () {
              createDoEvaluator(doCase, function () {
                generate.ifStatement(
                  function () { generate.retrieveAnonymous(triggered); },
                  function () { generate.returnStatement(); },
                  null
                );

                generate.statement(function () {
                  generate.assignAnonymous(
                    triggered, generate.literal(true)
                  );
                });
              });
            };
          }));
        });
      });
    }
  }

  function createMatchEvaluator(node: Syntax.MatchExpression) {
    generate.iife(function () {
      let exprResult = generate.createAnonymous();
      generate.statement(function () {
        generate.assignAnonymous(exprResult, defer(node.value));
      });

      node.matches.forEach(function (match) {
        generate.ifStatement(
          function () {
            createLikeComparison(
              function () { generate.retrieveAnonymous(exprResult); },
              defer(match.pattern)
            );
          },
          function () {
            createStatementsEvaluator(match.statements);
            generate.returnStatement();
          },
          null
        );
      });

      if ( !node.elseStatements.isEmpty() ) {
        createStatementsEvaluator(node.elseStatements);
      }
    });
  }

  function createCallEvaluator(node: Syntax.CallOperator) {
    generate.call(
      defer(node.left),
      node.right.map(function (argNode) {
        return defer(argNode);
      })
    );
  }

  function createBindEvaluator(node: Syntax.BindOperator) {
    generate.call(generate.runtimeImport('bindFunction'), [
      defer(node.left),
      function () {
        let elems: JavaScript.ObjectAssignmentItems = [];
        node.right.forEach(function (argNode, index) {
          if ( argNode instanceof Syntax.Wildcard ) {
            return;
          }
          elems.push(['' + index, <Function>defer(argNode), false]);
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

    generate.statement(function () {
      generate.assignAnonymous(result, getValue(node));
    });

    node.getIdentifiers().forEach(function (id, index) {
      generate.assignment(id.value, function () {
        generate.member(
          function () { generate.retrieveAnonymous(result); },
          '' + index
        );
      });
    });
  }

  function createObjectDestructureEvaluator(node: Syntax.ObjectDestructure,
                                            getValue: Function) {
    let result = generate.createAnonymous();

    generate.statement(function () {
      generate.assignAnonymous(result, getValue(node));
    });

    node.items.forEach(function (item) {
      generate.assignment(item.id.value, function () {
        generate.member(
          function () { generate.retrieveAnonymous(result); },
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
    generate.statement(function () {
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

      generate.statement(function () {
        generate.assignAnonymous(result, function () {
          (<Function>genContainer)([]);
        });
      });

      createLoop(node.ranges, createBody);
      generate.statement(function () {
        generate.assignResult(function () {
          generate.retrieveAnonymous(result);
        });
      });

      function createValueBody() {
        let arrayCompNode = <Syntax.ArrayComprehension>node;
        generate.statement(function () {
          generate.arrayAppend(result, defer(arrayCompNode.value));
        });
      }

      function createNameValueBody() {
        let objectCompNode = <Syntax.ObjectComprehension>node;
        let assign = objectCompNode.assignment;
        generate.statement(function () {
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
        function () { generate.retrieveAnonymous(successVar); },
        null,
        defer(createStatementsEvaluator, elseStatements)
      );
    }

    function generateReduceResult() {
      generate.statement(function () {
        generate.assignResult(function () {
          let ids = node.getReduceIdentifiers();
          if ( ids.length === 1 ) {
            generate.getter(ids[0].value);
            return;
          }
          generate.array(ids.map(function (id) {
            return function () {
              generate.getter(id.value);
            };
          }));
        });
      });
    }

    function generateReduceInitializers() {
      reduceAssignments.forEach(createEvaluator);
    }

    function createAnonymousCounters() {
      idMappings = node.getReduceIdentifiers().map(function (id) {
        return {
          id: id.value,
          anon: generate.createAnonymous()
        };
      });
    }

    function generateResultAssignments() {
      idMappings.forEach(function (mapping) {
        generate.assignment(mapping.id, function () {
          generate.retrieveAnonymous(mapping.anon);
        });
      });
    }

    function generateAnonymousAssignments() {
      idMappings.forEach(function (mapping) {
        generate.statement(function () {
          generate.assignAnonymous(mapping.anon, function () {
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
      generate.statement(function () {
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
          generate.statement(function () {
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
        guardFunc = function () {
          generate.ifStatement(
            defer(range.guard),
            null,
            function () { generate.loopContinue(); }
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
          body: function () {
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
    assignments.forEach(function (assignment) {
      assignment.getIdentifiers().forEach(function (id) {
        conditions.push(generate.code(function () {
          generate.call(some, [function () {
            generate.getter(id.value);
          }]);
        }));
      });
    });

    generateIf(
      function () { generate.writeAndGroup(conditions); },
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
      function () {
        generate.assignAnonymous(leftAnon, defer(node.left));
      },
      function () {
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
      function () {
        generate.assignAnonymous(leftAnon, defer(node.left));
      },
      function () {
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

  function createInEvaluator(node: Syntax.InOperator) {
    let isIn = generate.runtimeImport('isIn');
    generate.call(isIn, [defer(node.left), defer(node.right)]);
  }

  function createNotInEvaluator(node: Syntax.NotInOperator) {
    generate.unaryOperator('not', function () {
      let isIn = generate.runtimeImport('isIn');
      generate.call(isIn, [defer(node.left), defer(node.right)]);
    });
  }

  function createNotEvaluator(node: Syntax.NotOperator) {
    generate.unaryOperator('not', function () {
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
    if ( hasAnnotation(node, 'pattern/node') ) {
      createPatternTemplate(node);
      return;
    }
    generate.array(node.elements.map(defer));
  }

  function createObjectEvaluator(node: Syntax.ObjectConstructor) {
    if ( hasAnnotation(node, 'pattern/node') ) {
      createPatternTemplate(node);
      return;
    }
    let elems = node.elements.map(function (elem: Syntax.ObjectAssignment) {
      let name: string|Function;
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

  function createSelfEvaluator(node: Syntax.Self) {
    let selfPatternName = getAnnotation(node, 'pattern/local');
    if ( !selfPatternName ) {
      generate.self();
      return;
    }
    selfPatternName = generate.registerAnonymous(selfPatternName);
    generate.retrieveAnonymous(selfPatternName);
  }

  function createPatternEvaluator(node: Syntax.Pattern) {
    let definePattern = generate.runtimeImport('definePattern');
    generate.call(definePattern, [
      function () {
        generate.func({
          internalArgs: [generate.exportsName],
          body: patternBody
        });
      }
    ]);

    function patternBody() {
      let localName = getAnnotation(node, 'pattern/local');
      localName = generate.registerAnonymous(localName);

      generate.statement(function () {
        generate.assignAnonymous(localName, generate.exportsName);
      });

      generate.returnStatement(function () {
        createPatternTemplate(node.left);
      });
    }
  }

  function createPatternTemplate(node: Syntax.Node) {
    switch ( node.tag ) {
      case 'object':
      case 'array':
        createPatternElements(<Syntax.ElementsConstructor>node);
        break;
      case 'self':
        generate.write(generate.literal(true));
        break;
      default:
        if ( canGenerateEquality(node) ) {
          createLikeComparison(
            function () {
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

  function canGenerateEquality(elementValue: Syntax.Node) {
    return !hasAnnotation(elementValue, 'pattern/self') &&
           !(elementValue instanceof Syntax.RelationalOperator) &&
           !(elementValue instanceof Syntax.ElementsConstructor);
  }

  function createPatternElements(node: Syntax.ElementsConstructor) {
    let parentLocal = getAnnotation(node, 'pattern/local');
    parentLocal = generate.registerAnonymous(parentLocal);

    let isObject = node.tag === 'object';
    let containerCheckName = isObject ? 'isObject' : 'isArray';

    let expressions: Function[] = [];
    expressions.push(function () {
      let checker = generate.runtimeImport(containerCheckName);
      generate.call(checker, [function () {
        generate.retrieveAnonymous(parentLocal);
      }]);
    });

    if ( isObject ) {
      node.elements.forEach(function (assign: Syntax.ObjectAssignment) {
        pushElement(assign, assign.value, defer(assign.id));
      });
    }
    else {
      node.elements.forEach(function (expr: Syntax.Expression, idx: number) {
        pushElement(expr, expr, generate.literal(idx));
      });
    }
    generate.writeAndGroup(expressions);

    function pushElement(element: Syntax.Node, elementValue: Syntax.Node,
                         elementIndex: string|Function) {
      if ( elementValue.tag === 'self' ) {
        return;
      }

      if ( canGenerateEquality(elementValue) ) {
        expressions.push(generateEquality(elementValue, elementIndex));
        return;
      }

      expressions.push(generateNested(element, elementValue, elementIndex));
    }

    function generateEquality(elementValue: Syntax.Node,
                              elementIndex: string|Function) {
      if ( elementValue instanceof Syntax.Literal ) {
        return function () {
          createLikeComparison(value, elementValue);
        };
      }
      return function () {
        createLikeComparison(
          value, defer(elementValue, createPatternTemplate)
        );
      };

      function value() {
        generate.member(
          function () { generate.retrieveAnonymous(parentLocal); },
          elementIndex
        );
      }
    }

    function generateNested(element: Syntax.Node, elementValue: Syntax.Node,
                            elementIndex: string|Function) {
      let elementLocal = getAnnotation(element, 'pattern/local');
      elementLocal = generate.registerAnonymous(elementLocal);

      return function () {
        generate.compoundExpression([
          function () {
            generate.assignAnonymous(
              elementLocal,
              function () {
                generate.member(
                  function () { generate.retrieveAnonymous(parentLocal); },
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
