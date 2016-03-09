"use strict";

import * as JavaScript from './JavaScript';
import * as Syntax from './Syntax';

import { hasAnnotation, getAnnotation } from './Annotations';

type FunctionMap = { [index: string]: Function };
type FunctionNameMap = { [index: string]: string };
type IdMapping = { id: string, anon: string };

const slice = Array.prototype.slice;
const likeLiteralTypes = ['string', 'number', 'boolean', 'symbol'];

const waiterMap: FunctionNameMap = {
  'value': 'awaitValue',
  'any': 'awaitAny',
  'all': 'awaitAll'
};

/**
 * Converts a parse tree into source code (initially JavaScript). Host
 * Language-specific constructs are avoided here and instead produced
 * by JavaScript code generation module.
 */
export function generateScriptBody(parseTree: Syntax.Statements) {
  let globals = new JavaScript.Globals();
  let generate = JavaScript.createModule(globals);

  // a lookup table of code generators
  let Evaluators: FunctionMap = {
    'import': createImportEvaluator,
    'from': createFromEvaluator,
    'export': createExportEvaluator,
    'function': createFunctionEvaluator,
    'lambda': createLambdaEvaluator,
    'reduce': createReduceEvaluator,
    'do': createDoEvaluator,
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
  createScriptFunction(parseTree);
  let body = generate.toString();
  let buffer: string[] = [];
  buffer.push(globals.toString());
  buffer.push(body);
  return buffer.join('');

  function createScriptFunction(statements: Syntax.Statements) {
    generate.func({
      internalId: generate.selfName,
      internalArgs: [generate.contextName, generate.exportsName],
      body: function () {
        createStatementsEvaluator(statements);
      }
    });
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

  /**
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

      let moduleNameId = globals.literal(moduleName);
      let importer = globals.builder('importer', moduleNameId);

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
    generate.member(function () {
      generate.context();
    },
    globals.literal('__dirname'));
  }

  function createFromEvaluator(node: Syntax.FromStatement) {
    let assigns: any[] = [];
    let modulePath = node.path.value;
    let modulePathId = globals.literal(modulePath);
    let importer = globals.builder('importer', modulePathId);

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
            globals.literal(item.name.value)
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
    let ensure = globals.runtimeImport('ensure' + signatureType);
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

    let paramNames = params.map(function (param: Syntax.Parameter) {
      return param.id.value;
    });

    let create = signature.guard ? createGuarded : createUnguarded;
    create();

    function createUnguarded() {
      let functionName = node.signature.id;
      generate.funcDeclaration(functionName.value, {
        internalId: getFuncOrLambdaInternalId(node),
        contextArgs: paramNames,
        body: defer(createStatementsEvaluator, node.statements)
      });
    }

    function createGuarded() {
      let functionName = node.signature.id;
      let ensuredId = generateEnsured(functionName, 'Function');

      generate.funcDeclaration(functionName.value, {
        internalId: getFuncOrLambdaInternalId(node),
        contextArgs: paramNames,
        prolog: createProlog,
        body: defer(createStatementsEvaluator, node.statements)
      });

      function createProlog() {
        generate.ifStatement(
          defer(signature.guard),
          null,  // this is an 'else' case
          function () {
            generate.returnStatement(function () {
              generate.call(ensuredId);
            });
          }
        );
      }
    }
  }

  function createLambdaEvaluator(node: Syntax.LambdaExpression) {
    let signature = node.signature;
    let params = signature.params;

    let paramNames = params.map(function (param: Syntax.Parameter) {
      return param.id.value;
    });

    generate.parens(function () {
      generate.func({
        internalId: getFuncOrLambdaInternalId(node),
        contextArgs: paramNames,
        body: defer(createStatementsEvaluator, node.statements)
      });
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

  function createDoEvaluator(node: Syntax.DoExpression) {
    generate.call(globals.runtimeImport('createDoBlock'), [
      function () {
        generate.func({
          generator: true,
          body: doBody
        });
      }
    ]);

    function doBody() {
      if ( node.whenClause ) {
        let groups = getWhenGroups(node.whenClause.assignments);
        groups.forEach(generateGroup);
      }
      createStatementsEvaluator(node.statements);
    }

    function generateGroup(group: Syntax.Assignments) {
      let anon = generate.createAnonymous();
      generate.statement(function () {
        generate.assignAnonymous(anon, function () {
          generate.waitFor(function () {
            generate.array(
              group.map(function (assignment) {
                return defer(assignment.value);
              })
            );
          }, 'awaitAll');
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

    function getWhenGroups(assignments: Syntax.Assignments) {
      let groups: Syntax.Assignments[] = [];

      assignments.forEach(function (assignment) {
        let groupNum = getAnnotation(assignment, 'when/group') || 0;
        let group = groups[groupNum] || (groups[groupNum] = []);
        group.push(assignment);
      });

      return groups;
    }
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
    generate.call(globals.runtimeImport('bindFunction'), [
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
      generate.assignment(successVar, globals.literal(false));
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
            generate.assignAnonymous(successVar, globals.literal(true));
          });
        }
        createBody();
        return;
      }

      let range = ranges[i];
      let valueId = range.valueId.value;
      let nameId = range.nameId ? range.nameId.value : null;
      let prolog: Function;

      if ( range.guard ) {
        // we have a guard
        prolog = function () {
          generate.ifStatement(
            defer(range.guard),
            null,
            function () {
              generate.loopContinue();
            }
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
          guard: prolog,
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
    let some = globals.runtimeImport('isSomething');
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
    let isIn = globals.runtimeImport('isIn');
    generate.call(isIn, [defer(node.left), defer(node.right)]);
  }

  function createNotInEvaluator(node: Syntax.NotInOperator) {
    generate.unaryOperator('not', function () {
      let isIn = globals.runtimeImport('isIn');
      generate.call(isIn, [defer(node.left), defer(node.right)]);
    });
  }

  function createNotEvaluator(node: Syntax.NotOperator) {
    generate.unaryOperator('not', function () {
      let isTrue = globals.runtimeImport('isTrue');
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
    let waiter = waiterMap[node.resolver || 'value'];
    generate.waitFor(defer(node.left), waiter);
  }

  function createFormatEvaluator(node: Syntax.FormatOperator) {
    let formatStr = globals.literal((<Syntax.Literal>node.left).value);
    let formatter = globals.builder('buildFormatter', formatStr);
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
    let literal = globals.literal(node.value);
    generate.write(literal);
  }

  function createRegex(node: Syntax.Regex) {
    let regex = globals.builder('defineRegexPattern',
                                globals.literal(node.value));
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
    let definePattern = globals.runtimeImport('definePattern');
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
        generate.write(globals.literal(true));
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
      let checker = globals.runtimeImport(containerCheckName);
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
        pushElement(expr, expr, globals.literal(idx));
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
      let isMatch = globals.runtimeImport('isMatch');
      generate.call(isMatch, [right, left]);
      return;
    }

    if ( isLikeLiteral(rightNode) ) {
      generate.binaryOperator('eq', left, right);
      return;
    }

    let matcher = globals.builder('buildMatcher', generate.code(right));
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
