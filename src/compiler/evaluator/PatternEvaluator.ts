"use strict";

import * as Target from '../target';
import * as Syntax from '../syntax';
import { NodeEvaluator } from './Evaluator';
import { StatementsEvaluator } from './BasicEvaluator';

const likeLiteralTypes = ['string', 'number', 'boolean', 'symbol'];
const cachedPatternThreshold = 8;

type FunctionMap = { [index: string]: Function };

export class RegexEvaluator extends NodeEvaluator {
  public static tags = ['regex'];
  public node: Syntax.Regex;

  public evaluate() {
    let regex = this.coder.builder(
      'defineRegexPattern', this.coder.literal(this.node.value)
    );
    this.coder.write(regex);
  }
}

abstract class LikeComparisonEvaluator extends NodeEvaluator {
  protected createLikeComparison(leftNode: Syntax.Node|Function,
                                 rightNode: Syntax.Node|Function) {
    let left = this.deferIfNotAlready(leftNode);
    let right = this.deferIfNotAlready(rightNode);

    if ( !(rightNode instanceof Syntax.Literal) ) {
      let isMatch = this.coder.runtimeImport('isMatch');
      this.coder.call(isMatch, [right, left]);
      return;
    }

    if ( this.isLikeLiteral(rightNode) ) {
      this.coder.binaryOperator('eq', left, right);
      return;
    }

    let matcher = this.coder.builder('buildMatcher', this.coder.code(right));
    this.coder.call(matcher, [left]);
  }

  private deferIfNotAlready(node: Syntax.Node|Function) {
    return typeof node === 'function' ? <Function>node : this.defer(node);
  }

  private isLikeLiteral(node: Syntax.Node|Function) {
    let valueType = typeof (<Syntax.Literal>node).value;
    return likeLiteralTypes.indexOf(valueType) !== -1;
  }
}

export class LikeEvaluator extends LikeComparisonEvaluator {
  public static tags = ['like'];
  public node: Syntax.LikeOperator;

  public evaluate() {
    this.createLikeComparison(this.node.left, this.node.right);
  }
}

export class NotLikeEvaluator extends LikeComparisonEvaluator {
  public static tags = ['notLike'];
  public node: Syntax.NotLikeOperator;

  public evaluate() {
    this.coder.unaryOperator('not', () => {
      this.createLikeComparison(this.node.left, this.node.right);
    });
  }
}

export class MatchEvaluator extends LikeComparisonEvaluator {
  public static tags = ['match'];
  public node: Syntax.MatchExpression;

  public evaluate() {
    let self = this;
    let generator = self.node.value ? generateExpression : generateFunction;
    generator();

    function generateExpression() {
      self.coder.iife(() => {
        generateBody(self.defer(self.node.value));
      });
    }

    function generateFunction() {
      self.coder.parens(() => {
        self.coder.func({
          internalArgs: [self.coder.valueName],
          body: () => {
            generateBody(self.coder.valueName);
          }
        });
      });
    }

    function generateBody(valueGenerator: Target.BodyEntry) {
      let value = self.coder.createAnonymous();
      self.coder.statement(() => {
        self.coder.assignAnonymous(value, valueGenerator);
      });

      self.node.matches.forEach(match => {
        self.coder.ifStatement(
          () => {
            self.createLikeComparison(
              () => { self.coder.retrieveAnonymous(value); },
              self.defer(match.pattern)
            );
          },
          () => {
            new StatementsEvaluator(self, match.statements).evaluate();
            self.coder.returnStatement();
          },
          null
        );
      });

      if ( self.node.elseStatements.isEmpty() ) {
        let exploder = self.coder.runtimeImport('matchNotExhaustive');
        self.coder.statement(() => {
          self.coder.call(exploder, []);
        });
        return;
      }

      new StatementsEvaluator(self, self.node.elseStatements).evaluate();
    }
  }
}

abstract class BasePatternEvaluator extends LikeComparisonEvaluator {
  protected createPatternTemplate(node: Syntax.Node) {
    switch ( node.tag ) {
      case 'objectPattern':
      case 'arrayPattern':
        new NestedPatternEvaluator(this, node).evaluate();
        break;
      case 'context':
        this.coder.write(this.coder.literal(true));
        break;
      default:
        if ( Syntax.hasAnnotation(node, 'pattern/equality') ) {
          this.createLikeComparison(
            () => {
              let localName = Syntax.getAnnotation(node, 'pattern/local');
              localName = this.coder.registerAnonymous(localName);
              this.coder.retrieveAnonymous(localName);
            },
            node
          );
          return;
        }
        this.coder.write(this.defer(node));
    }
  }
}

export class PatternEvaluator extends BasePatternEvaluator {
  public static tags = ['pattern'];
  public node: Syntax.Pattern;

  public evaluate() {
    let defineName = this.getPatternDefineMethodName(this.node);
    let definePattern = this.coder.runtimeImport(defineName);
    this.coder.call(definePattern, [
      () => {
        this.coder.func({
          internalArgs: [Syntax.getAnnotation(this.node, 'pattern/local')],
          body: () => {
            this.coder.returnStatement(() => {
              this.createPatternTemplate(this.node.left);
            });
          }
        });
      }
    ]);
  }

  private getPatternDefineMethodName(node: Syntax.Pattern) {
    let complexity = Syntax.getAnnotation(node, 'pattern/complexity');
    return complexity > cachedPatternThreshold ? 'defineCachedPattern'
                                               : 'definePattern';
  }
}

export class NestedPatternEvaluator extends BasePatternEvaluator {
  public static tags = ['objectPattern', 'arrayPattern'];
  public node: Syntax.CollectionPattern;

  public evaluate() {
    let self = this;
    let parentLocal = Syntax.getAnnotation(this.node, 'pattern/local');
    parentLocal = self.coder.registerAnonymous(parentLocal);

    let isObject = this.node instanceof Syntax.ObjectPattern;
    let containerCheckName = isObject ? 'isObject' : 'isArray';

    let expressions: Function[] = [];
    expressions.push(() => {
      let checker = self.coder.runtimeImport(containerCheckName);
      self.coder.call(checker, [() => {
        self.coder.retrieveAnonymous(parentLocal);
      }]);
    });

    this.node.elements.forEach(element => {
      if ( element instanceof Syntax.PatternElement ) {
        pushElement(element);
      }
      else {
        expressions.push(self.defer(element));
      }
    });
    self.coder.writeAndGroup(expressions);

    function pushElement(element: Syntax.PatternElement) {
      if ( element.value instanceof Syntax.Wildcard ) {
        expressions.push(generatePropertyCheck(element));
        return;
      }

      if ( Syntax.hasAnnotation(element.value, 'pattern/equality') ) {
        expressions.push(
          generateEquality(element.value, self.defer(element.id))
        );
        return;
      }

      expressions.push(
        generateNested(element, element.value, self.defer(element.id))
      );
    }

    function generatePropertyCheck(element: Syntax.PatternElement) {
      return () => {
        self.coder.call(() => {
          self.coder.member(
            () => { self.coder.retrieveAnonymous(parentLocal); },
            self.coder.literal('hasOwnProperty')
          );
        }, [self.defer(element.id)]);
      };
    }

    function generateEquality(elementValue: Syntax.Node,
                              elementIndex: Target.BodyEntry) {
      if ( elementValue instanceof Syntax.Literal ) {
        return () => {
          self.createLikeComparison(value, elementValue);
        };
      }
      return () => {
        self.createLikeComparison(value, self.defer(elementValue));
      };

      function value() {
        self.coder.member(
          () => { self.coder.retrieveAnonymous(parentLocal); },
          elementIndex
        );
      }
    }

    function generateNested(element: Syntax.Node, elementValue: Syntax.Node,
                            elementIndex: Target.BodyEntry) {
      let elementLocal = Syntax.getAnnotation(element, 'pattern/local');
      elementLocal = self.coder.registerAnonymous(elementLocal);

      return () => {
        self.coder.compoundExpression([
          () => {
            self.coder.assignAnonymous(
              elementLocal,
              () => {
                self.coder.member(
                  () => { self.coder.retrieveAnonymous(parentLocal); },
                  elementIndex
                );
              }
            );
          },
          self.defer(elementValue)
        ]);
      };
    }
  }
}
