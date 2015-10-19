/// <reference path="./Annotations.ts"/>
/// <reference path="./JavaScript.ts"/>

"use strict";

namespace Fate.Compiler.CodeGen {
  type FunctionMap = { [index: string]: Function };

  var slice = Array.prototype.slice;
  var likeLiteralTypes = ['string', 'number', 'boolean', 'symbol'];

  /**
   * Converts a parse tree into source code (initially JavaScript) that can
   * be pulled into an Fate Runtime instance.  Host Language-specific
   * constructs are avoided here and instead produced by JavaScript code
   * generation module.
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
      'lit': createLiteral,
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
        name: 's',
        internalArgs: ['c', 'x'],
        body: function () {
          createStatementsEvaluator(parseTree);
        },
        annotations: parseTree.annotations
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
            generate.call(importer, []);
          }
        ]);
      });
      generate.assignments(assigns);
    }

    function createFromEvaluator(node: Syntax.FromStatement) {
      var assigns: any[] = [];
      var modulePath = node.modulePath.value;
      var modulePathId = globals.literal(modulePath);
      var importer = globals.builder('importer', modulePathId);

      var anon = generate.createAnonymous();
      assigns.push([
        anon,
        function () {
          generate.call(importer, []);
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
            body: defer(createStatementsEvaluator, node.statements),
            annotations: node.annotations
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
                body: unguardedBody,
                annotations: node.annotations
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
          
          var destructuredNames = [function () {
            generate.retrieveAnonymous(joinArgs)
          }].concat(paramNames.map(function (paramName) {
            return function () {
              generate.getter(paramName);
            };
          }));
          
          generate.statement(function () {
            generate.arrayDestructure(destructuredNames, function () {
              generate.call(globals.runtimeImport('joinArguments'), [
                function () {
                  generate.functionArguments();
                }
              ]);
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
          var defineFunction = globals.runtimeImport('defineGuardedChannel');
          generate.call(defineFunction, [
            generate.code(function () {
              generate.getter(functionName.value);
            }),
            createWrapper
          ]);

          function createWrapper() {
            generate.func({
              internalArgs: ['o'],
              body: function () {
                generate.returnStatement(createFunction);
              },
              annotations: node.annotations
            });
          }

          function createFunction() {
            generate.func({
              contextArgs: paramNames,
              body: createFunctionBody,
              annotations: node.annotations
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
              generate.call('o', [function () {
                generate.retrieveAnonymous(joinArgs);
              }]);
            });
          }
        }
      }
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
        generate.call(globals.runtimeImport('defineFunction'), [
          function () {
            generate.func({
              contextArgs: paramNames,
              body: defer(createStatementsEvaluator, node.statements),
              annotations: node.annotations
            });
          }
        ]);
      }

      function createGuarded() {
        var functionName = node.signature.id;
        generate.call(globals.runtimeImport('defineGuardedFunction'), [
          generate.code(function () {
            generate.getter(functionName.value);
          }),
          createWrapper
        ]);

        function createWrapper() {
          generate.func({
            internalArgs: ['o'],
            body: function () {
              generate.returnStatement(createFunction);
            },
            annotations: node.annotations
          });
        }

        function createFunction() {
          generate.func({
            contextArgs: paramNames,
            prolog: createProlog,
            body: defer(createStatementsEvaluator, node.statements),
            annotations: node.annotations
          });
        }

        function createProlog() {
          generate.ifStatement(
            defer(signature.guard),
            null,  // this is an 'else' case
            function () {
              generate.returnStatement(function () {
                generate.call('o');
              });
            }
          );
        }
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
      var isObject = node instanceof Syntax.ObjectComprehension;
      var genContainer: Function = isObject ? generate.object : generate.array;
      var createBody = isObject ? createNameValueBody : createValueBody;
      var result = generate.createAnonymous();

      generate.compoundExpression([
        function () {
          generate.assignAnonymous(result, defer(function () {
            genContainer([]);
          }));
        },
        function () {
          createLoop(node.ranges, createBody, node.annotations);
        },
        function () {
          generate.retrieveAnonymous(result);
        }
      ]);

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
          generate.objectAssign(result, defer(assign.id), defer(assign.value));
        });
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
        var nameId = range.nameId.value;
        var prolog: Function;

        if ( range.guard ) {
          // We have a guard
          prolog = function () {
            generate.ifStatement(
              defer(range.guard),
              null,
              function () {
                generate.returnStatement();
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
            },
            annotations: annotations
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
      var left = defer(node.left);
      var right = defer(node.right);

      if ( !(node.right instanceof Syntax.Literal) ) {
        var isMatchingObject = globals.runtimeImport('isMatchingObject');
        generate.call(isMatchingObject, [right, left]);
        return;
      }

      if ( isLikeLiteral(node.right) ) {
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

    function createInEvaluator(node: Syntax.InOperator) {
      var isIn = globals.runtimeImport('isIn');
      generate.call(isIn, [defer(node.left), defer(node.right)]);
    }

    function createNotInEvaluator(node: Syntax.NotInOperator) {
      var isIn = globals.runtimeImport('isIn');
      generate.unaryOperator('not', function () {
        generate.call(isIn, [defer(node.left), defer(node.right)]);
      });
    }

    function createNotEvaluator(node: Syntax.NotOperator) {
      var isTruthy = globals.runtimeImport('isTruthy');
      generate.unaryOperator('not', function () {
        generate.call(isTruthy, [defer(node.left)]);
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

    function createSelfEvaluator(node: Syntax.Self) {
      generate.self();
    }

    function createWildcard(node: Syntax.Wildcard) {
      var wildcardName = hasAnnotation(node, 'pattern/local');
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
            internalArgs: ['x'],
            body: patternBody,
            annotations: node.annotations
          });
        }
      ]);

      function patternBody() {
        var localName = hasAnnotation(node, 'pattern/local');
        localName = generate.registerAnonymous(localName);

        generate.statement(function () {
          generate.assignAnonymous(localName, 'x');
        });

        generate.returnStatement(
          defer(createPatternTemplate, node.left)
        );
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
          generate.write(defer(node));
      }
    }

    function createPatternElements(node: Syntax.ElementsConstructor) {
      var parentLocal = hasAnnotation(node, 'pattern/local');
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

      function canGenerateEquality(elementValue: Syntax.Node) {
        return !hasAnnotation(elementValue, 'pattern/wildcard') &&
               !(elementValue instanceof Syntax.RelationalOperator) &&
               !(elementValue instanceof Syntax.ElementsConstructor);
      }

      function generateEquality(elementValue: Syntax.Node,
                                elementIndex: string|Function) {
        // If we're just dealing with an expression,
        return function () {
          generate.binaryOperator('eq',
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
        var elementLocal = <string>hasAnnotation(element, 'pattern/local');
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
  }
}
