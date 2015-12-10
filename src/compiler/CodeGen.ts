"use strict";

import * as JavaScript from './JavaScript';
import * as Syntax from './Syntax';

import { hasAnnotation, getAnnotation, Annotations } from './Annotations';

type FunctionMap = { [index: string]: Function };

let slice = Array.prototype.slice;
let likeLiteralTypes = ['string', 'number', 'boolean', 'symbol'];

/**
  * Converts a parse tree into source code (initially JavaScript). Host
  * Language-specific constructs are avoided here and instead produced
  * by JavaScript code generation module.
  *
  * @param {Object} parseTree the parse tree to use
  */
export function generateScriptBody(parseTree: Syntax.Statements) {
  let globals = new JavaScript.Globals();
  let generate = JavaScript.createModule(globals);

  // a lookup table of code generators
  let Evaluators: FunctionMap = {
    'import': createImportEvaluator,
    'from': createFromEvaluator,
    'export': createExportEvaluator,
    'channel': createChannelEvaluator,
    'function': createFunctionEvaluator,
    'lambda': createLambdaEvaluator,
    'call': createCallEvaluator,
    'bind': createBindEvaluator,
    'let': createLetEvaluator,
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
    'format': createFormatEvaluator,
    'member': createMemberEvaluator,
    'array': createArrayEvaluator,
    'object': createObjectEvaluator,
    'id':  createIdEvaluator,
    'literal': createLiteral,
    'regex': createRegex,
    'self': createSelfEvaluator,
    'pattern': createPatternEvaluator
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
    let exports = node.exportList.map(function (item: Syntax.ModuleItem) {
      let name = item.name.value;
      let alias = item.alias.value;
      return <JavaScript.ModuleItem>[name, alias];
    });

    generate.exports(exports);
  }

  function createChannelEvaluator(node: Syntax.ChannelDeclaration) {
    let signatures = node.signatures;
    let allParamNames: string[] = [];
    signatures.forEach(function (signature: Syntax.Signature) {
      allParamNames = allParamNames.concat(
        signature.params.map(function (param: Syntax.Parameter) {
          return param.id.value;
        })
      );
    });

    let joinName = generate.createAnonymous();
    generate.assignment(joinName, function() {
      let joinArgs: any[] = [];
      joinArgs.push(function() {
        generate.func({
          contextArgs: allParamNames,
          body: defer(createStatementsEvaluator, node.statements)
        });
      });
      signatures.forEach(function (signature) {
        joinArgs.push(globals.literal(signature.params.length));
      });
      generate.call(globals.runtimeImport('join'), joinArgs);
    });

    signatures.forEach(createChannelSignature);

    function createChannelSignature(signature: Syntax.Signature,
                                    signatureIndex: number) {
      let paramNames = signature.params.map(
        function (param: Syntax.Parameter) { return param.id.value; }
      );

      let create = signature.guard ? createGuarded : createUnguarded;
      create();

      function createUnguarded() {
        generate.assignment(signature.id.value, function () {
          generate.call(globals.runtimeImport('defineChannel'), [
            function () {
              generate.func({
                contextArgs: paramNames,
                body: unguardedBody
              });
            }
          ]);
        });
      }

      function unguardedBody() {
        let joinArgs = createArgumentsProlog();
        joinDispatcher(joinArgs);
      }

      function createArgumentsProlog() {
        let joinArgs = generate.createAnonymous();
        let assignedNames = [joinArgs].concat(paramNames);
        generate.statement(function () {
          generate.assignFromArray(assignedNames, function () {
            generate.call(globals.runtimeImport('joinArguments'));
          });
        });
        return joinArgs;
      }

      function joinDispatcher(joinArgs: string) {
        generate.statement(function () {
          generate.call(joinName, [
            globals.literal(signatureIndex),
            function () {
              generate.retrieveAnonymous(joinArgs);
            }
          ]);
        });
      }

      function createGuarded() {
        let functionName = signature.id;
        let ensuredId = generateEnsured(functionName, 'Channel');

        generate.assignment(signature.id.value, function () {
          let defineFunction = globals.runtimeImport('defineChannel');
          generate.call(defineFunction, [createFunction]);
        });

        function createFunction() {
          generate.func({
            body: createFunctionBody
          });
        }

        function createFunctionBody() {
          let joinArgs = createArgumentsProlog();
          generate.ifStatement(
            defer(signature.guard),
            function () {
              joinDispatcher(joinArgs);
            },
            null
          );

          generate.returnStatement(function () {
            generate.call(ensuredId,
              [function () { generate.retrieveAnonymous(joinArgs); }]
            );
          });
        }
      }
    }
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
      generate.funcDecl(functionName.value, {
        internalId: getFuncOrLambdaInternalId(node),
        contextArgs: paramNames,
        body: defer(createStatementsEvaluator, node.statements)
      });
    }

    function createGuarded() {
      let functionName = node.signature.id;
      let ensuredId = generateEnsured(functionName, 'Function');

      generate.funcDecl(functionName.value, {
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
    let decls = node.assignments.map(function (assign: Syntax.Assignment) {
      return <JavaScript.AssignmentItem>[
        assign.id.value,
        defer(assign.value)
      ];
    });
    generate.assignments(decls);
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
    generate.parens(function () {
      generate.call(function () {
        generate.func({
          body: functionWrapperBody
        });
      }, []);
    });

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

      createLoop(node.ranges, createBody, node.annotations);

      generate.returnStatement(function () {
        generate.retrieveAnonymous(result);
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
    let elseStatements = node.elseStatements;
    let successVar: string;

    if ( !elseStatements.isEmpty() ) {
      successVar = generate.createAnonymous();
      generate.assignment(successVar, globals.literal(false));
      generate.statement(function () {
        createLoop(node.ranges, createBody, node.annotations, successVar);
      });
      generate.ifStatement(
        function () {
          generate.retrieveAnonymous(successVar);
        },
        null,
        defer(createStatementsEvaluator, elseStatements)
      );
    }
    else {
      generate.statement(function () {
        createLoop(node.ranges, createBody, node.annotations);
      });
    }

    function createBody() {
      createStatementsEvaluator(node.loopStatements);
    }
  }

  function createLoop(ranges: Syntax.Ranges, createBody: Function,
                      annotations: Annotations, successVar?: string) {
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
    let conditions = assignments.map(function (assignment) {
      return generate.code(function () {
        generate.call(some, [function () {
          generate.getter(assignment.id.value);
        }]);
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
      let isMatchingObject = globals.runtimeImport('isMatchingObject');
      generate.call(isMatchingObject, [right, left]);
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
