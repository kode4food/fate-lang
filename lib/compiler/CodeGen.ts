/// <reference path="./Annotations.ts"/>
/// <reference path="./JavaScript.ts"/>

"use strict";

namespace Fate.Compiler.CodeGen {
  type FunctionMap = { [index: string]: Function };

  var slice = Array.prototype.slice;
  var likeLiteralTypes = ['string', 'number', 'boolean', 'symbol'];

  /**
   * Converts a parse tree into source code (initially JavaScript). Host
   * Language-specific constructs are avoided here and instead produced
   * by JavaScript code generation module.
   *
   * @param {Object} strippedTree the parse tree to use
   */
  export function generateScriptBody(strippedTree: Syntax.Statements) {
    var globals = new JavaScript.Globals();
    var generate = JavaScript.createModule(globals);

    // A lookup table of code generators
    var Evaluators: FunctionMap = {
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
      'self': createSelfEvaluator,
      'literal': createLiteral,
      'regex': createRegex,
      'wildcard': createWildcard,
      'pattern': createPatternEvaluator
    };

    // Generate the module function and return the source code
    createScriptFunction(strippedTree);
    var body = generate.toString();
    var buffer: string[] = [];
    buffer.push(globals.toString());
    buffer.push(body);
    return buffer.join('');

    function createScriptFunction(parseTree: Syntax.Statements) {
      generate.func({
        internalId: generate.selfName,
        internalArgs: [generate.contextName, generate.exportsName],
        body: function () {
          createStatementsEvaluator(parseTree);
        }
      });
    }

    function defer(...args: any[]) {
      var func: Function;
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

      var nodeType = node.tag;
      var createFunction = Evaluators[nodeType];

      /* istanbul ignore if: untestable */
      if ( !createFunction ) {
        throw new Error("Stupid Coder: Invalid tag in Node: " + nodeType);
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
      var assigns: JavaScript.AssignmentItems = [];
      node.modules.forEach(function (module: Syntax.ModuleSpecifier) {
        var moduleName = module.path.value;
        var moduleAlias = module.alias.value;

        var moduleNameId = globals.literal(moduleName);
        var importer = globals.builder('importer', moduleNameId);

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
      var assigns: any[] = [];
      var modulePath = node.path.value;
      var modulePathId = globals.literal(modulePath);
      var importer = globals.builder('importer', modulePathId);

      var anon = generate.createAnonymous();
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
      var exports = node.exportList.map(function (item: Syntax.ModuleItem) {
        var name = item.name.value;
        var alias = item.alias.value;
        return <JavaScript.ModuleItem>[name, alias];
      });

      generate.exports(exports);
    }

    function createChannelEvaluator(node: Syntax.ChannelDeclaration) {
      var signatures = node.signatures;
      var allParamNames: string[] = [];
      signatures.forEach(function (signature: Syntax.Signature) {
        allParamNames = allParamNames.concat(
          signature.params.map(function (param: Syntax.Parameter) {
            return param.id.value;
          })
        );
      });

      var joinName = generate.createAnonymous();
      generate.assignment(joinName, function() {
        var joinArgs: any[] = [];
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
        var paramNames = signature.params.map(
          function (param: Syntax.Parameter) { return param.id.value; }
        );

        generate.assignment(signature.id.value, function () {
          var create = signature.guard ? createGuarded : createUnguarded;
          create();
        });

        function createUnguarded() {
          generate.call(globals.runtimeImport('defineChannel'), [
            function () {
              generate.func({
                contextArgs: paramNames,
                body: unguardedBody
              });
            }
          ]);
        }

        function unguardedBody() {
          var joinArgs = createArgumentsProlog();
          joinDispatcher(joinArgs);
        }

        function createArgumentsProlog() {
          var joinArgs = generate.createAnonymous();
          var assignedNames = [joinArgs].concat(paramNames);
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
                generate.retrieveAnonymous(joinArgs)
              }
            ]);
          });
        }

        function createGuarded() {
          var functionName = signature.id;
          var originalId = generate.code(function () {
            generate.getter(functionName.value);
          });

          var defineFunction = globals.runtimeImport('defineChannel');
          generate.call(defineFunction, [createFunction]);

          function createFunction() {
            generate.func({
              body: createFunctionBody
            });
          }

          function createFunctionBody() {
            var joinArgs = createArgumentsProlog();
            generate.ifStatement(
              defer(signature.guard),
              function () {
                joinDispatcher(joinArgs);
              },
              null
            );

            generate.returnStatement(function () {
              generate.call(
                function () {
                  var ensure = globals.runtimeImport('ensureChannel');
                  generate.call(ensure, [originalId])
                },
                [function () { generate.retrieveAnonymous(joinArgs); }]
              );
            });
          }
        }
      }
    }

    function getFuncOrLambdaInternalId(node: Syntax.Node) {
      var hasSelf = hasAnnotation(node, 'function/self');
      return hasSelf ? generate.selfName : undefined;
    }

    function createFunctionEvaluator(node: Syntax.FunctionDeclaration) {
      var signature = node.signature;
      var params = signature.params;

      var paramNames = params.map(function (param: Syntax.Parameter) {
        return param.id.value;
      });

      var create = signature.guard ? createGuarded : createUnguarded;
      create();

      function createUnguarded() {
        var functionName = node.signature.id
        generate.funcDecl(functionName.value, {
          internalId: getFuncOrLambdaInternalId(node),
          contextArgs: paramNames,
          body: defer(createStatementsEvaluator, node.statements)
        });
      }

      function createGuarded() {
        var functionName = node.signature.id;
        var originalId = generate.code(function () {
          generate.getter(functionName.value);
        });

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
                generate.call(function () {
                  var ensure = globals.runtimeImport('ensureFunction');
                  generate.call(ensure, [originalId])
                });
              });
            }
          );
        }
      }
    }

    function createLambdaEvaluator(node: Syntax.LambdaExpression) {
      var signature = node.signature;
      var params = signature.params;

      var paramNames = params.map(function (param: Syntax.Parameter) {
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
          var elems: JavaScript.ObjectAssignmentItems = [];
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
      var decls = node.assignments.map(function (assign: Syntax.Assignment) {
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
        var isObject = node instanceof Syntax.ObjectComprehension;
        var genContainer = isObject ? generate.object : generate.array;
        var createBody = isObject ? createNameValueBody : createValueBody;
        var result = generate.createAnonymous();

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
          var arrayCompNode = <Syntax.ArrayComprehension>node;
          generate.statement(function () {
            generate.arrayAppend(result, defer(arrayCompNode.value));
          });
        }

        function createNameValueBody() {
          var objectCompNode = <Syntax.ObjectComprehension>node;
          var assign = objectCompNode.assignment;
          generate.statement(function () {
            generate.objectAssign(
              result, defer(assign.id), defer(assign.value)
            );
          });
        }
      }
    }

    function createForEvaluator(node: Syntax.ForStatement) {
      var elseStatements = node.elseStatements;
      var successVar: string;

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

        var range = ranges[i];
        var valueId = range.valueId.value;
        var nameId = range.nameId ? range.nameId.value : null;
        var prolog: Function;

        if ( range.guard ) {
          // We have a guard
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
      var thens = node.thenStatements.isEmpty() ? null: node.thenStatements;
      var elses = node.elseStatements.isEmpty() ? null : node.elseStatements;
      generate.ifStatement(
        defer(node.condition),
        thens ? defer(createStatementsEvaluator, thens) : null,
        elses ? defer(createStatementsEvaluator, elses) : null
      );
    }

    function createOrEvaluator(node: Syntax.OrOperator) {
      var leftAnon = generate.createAnonymous();
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
      var leftAnon = generate.createAnonymous();
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
      var isIn = globals.runtimeImport('isIn');
      generate.call(isIn, [defer(node.left), defer(node.right)]);
    }

    function createNotInEvaluator(node: Syntax.NotInOperator) {
      generate.unaryOperator('not', function () {
        var isIn = globals.runtimeImport('isIn');
        generate.call(isIn, [defer(node.left), defer(node.right)]);
      });
    }

    function createNotEvaluator(node: Syntax.NotOperator) {
      generate.unaryOperator('not', function () {
        var isTrue = globals.runtimeImport('isTrue');
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
      var formatStr = globals.literal((<Syntax.Literal>node.left).value);
      var formatter = globals.builder('buildFormatter', formatStr);
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
      var elems = node.elements.map(function (elem: Syntax.ObjectAssignment) {
        var name: string|Function;
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
      var literal = globals.literal(node.value);
      generate.write(literal);
    }

    function createRegex(node: Syntax.Regex) {
      var regex = globals.builder('defineRegexPattern',
                                  globals.literal(node.value));
      generate.write(regex);
    }

    function createSelfEvaluator(node: Syntax.Self) {
      generate.self();
    }

    function createWildcard(node: Syntax.Wildcard) {
      var wildcardName = getAnnotation(node, 'pattern/local');
      /* istanbul ignore if: untestable */
      if ( !wildcardName ) {
        throw new Error("Stupid Coder: wildcardName was never assigned");
      }
      wildcardName = generate.registerAnonymous(wildcardName);
      generate.retrieveAnonymous(wildcardName);
    }

    function createPatternEvaluator(node: Syntax.Pattern) {
      var definePattern = globals.runtimeImport('definePattern');
      generate.call(definePattern, [
        function () {
          generate.func({
            internalArgs: [generate.exportsName],
            body: patternBody
          });
        }
      ]);

      function patternBody() {
        var localName = getAnnotation(node, 'pattern/local');
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
        case 'wildcard':
          generate.write(globals.literal(true));
          break;
        default:
          if ( canGenerateEquality(node) ) {
            createLikeComparison(
              function () {
                var localName = getAnnotation(node, 'pattern/local');
                localName = generate.registerAnonymous(localName);
                generate.retrieveAnonymous(localName)
              },
              node
            );
            return;
          }
          generate.write(defer(node));
      }
    }

    function canGenerateEquality(elementValue: Syntax.Node) {
      return !hasAnnotation(elementValue, 'pattern/wildcard') &&
             !(elementValue instanceof Syntax.RelationalOperator) &&
             !(elementValue instanceof Syntax.ElementsConstructor);
    }

    function createPatternElements(node: Syntax.ElementsConstructor) {
      var parentLocal = getAnnotation(node, 'pattern/local');
      parentLocal = generate.registerAnonymous(parentLocal);

      var isObject = node.tag === 'object';
      var containerCheckName = isObject ? 'isObject' : 'isArray';

      var expressions: Function[] = [];
      expressions.push(function () {
        var checker = globals.runtimeImport(containerCheckName);
        generate.call(checker, [function () {
          generate.retrieveAnonymous(parentLocal)
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
        if ( elementValue.tag === 'wildcard' ) {
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
        // If we're just dealing with an expression,
        return function () {
          createLikeComparison(
            function () {
              generate.member(
                function () { generate.retrieveAnonymous(parentLocal) },
                elementIndex
              );
            },
            defer(elementValue, createPatternTemplate)
          );
        };
      }

      function generateNested(element: Syntax.Node, elementValue: Syntax.Node,
                              elementIndex: string|Function) {
        var elementLocal = getAnnotation(element, 'pattern/local');
        elementLocal = generate.registerAnonymous(elementLocal);

        return function () {
          generate.compoundExpression([
            function () {
              generate.assignAnonymous(
                elementLocal,
                function () {
                  generate.member(
                    function () { generate.retrieveAnonymous(parentLocal) },
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
                                  rightNode: Syntax.Node) {
      var left = typeof leftNode === 'function' ? <Function>leftNode
                                                : defer(leftNode);

      var right = typeof rightNode === 'function' ? <Function>rightNode
                                                  : defer(rightNode);

      if ( !(rightNode instanceof Syntax.Literal) ) {
        var isMatchingObject = globals.runtimeImport('isMatchingObject');
        generate.call(isMatchingObject, [right, left]);
        return;
      }

      if ( isLikeLiteral(rightNode) ) {
        generate.binaryOperator('eq', left, right);
        return;
      }

      var matcher = globals.builder('buildMatcher', generate.code(right));
      generate.call(matcher, [left]);
    }

    function isLikeLiteral(node: Syntax.Node) {
      if ( !(node instanceof Syntax.Literal) ) {
        return false;
      }
      var valueType = typeof (<Syntax.Literal>node).value;
      return likeLiteralTypes.indexOf(valueType) !== -1;
    }
  }
}
