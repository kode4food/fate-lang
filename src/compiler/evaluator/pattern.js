/** @flow */

import * as Target from '../target';
import * as Syntax from '../syntax';
import { NodeEvaluator } from './evaluator';

const likeLiteralTypes = ['string', 'number', 'boolean', 'symbol'];
const cachedPatternThreshold = 8;

export class RegexEvaluator extends NodeEvaluator {
  static tags = ['regex'];
  node: Syntax.Regex;

  evaluate(...args: any[]) {
    const regex = this.coder.builder(
      'defineRegexPattern', this.coder.literal(this.node.value),
    );
    this.coder.write(regex);
  }
}

class LikeComparisonEvaluator extends NodeEvaluator {
  createLikeComparison(leftNode: Syntax.Node | Function,
    rightNode: Syntax.Node | Function) {
    const left = this.deferIfNotAlready(leftNode);
    const right = this.deferIfNotAlready(rightNode);

    if (!(rightNode instanceof Syntax.Literal)) {
      const isMatch = this.coder.runtimeImport('isMatch');
      this.coder.call(isMatch, [right, left]);
      return;
    }

    if (this.isLikeLiteral(rightNode)) {
      this.coder.binaryOperator('eq', left, right);
      return;
    }

    const matcher = this.coder.builder('buildMatcher', this.coder.code(right));
    this.coder.call(matcher, [left]);
  }

  deferIfNotAlready(node: Syntax.Node | Function) {
    return typeof node === 'function' ? node : this.defer(node);
  }

  isLikeLiteral(node: Syntax.Node | Function) {
    const valueType = typeof node.value;
    return likeLiteralTypes.indexOf(valueType) !== -1;
  }
}

export class LikeEvaluator extends LikeComparisonEvaluator {
  static tags = ['like'];
  node: Syntax.LikeOperator;

  evaluate(...args: any[]) {
    this.createLikeComparison(this.node.left, this.node.right);
  }
}

export class NotLikeEvaluator extends LikeComparisonEvaluator {
  static tags = ['notLike'];
  node: Syntax.NotLikeOperator;

  evaluate(...args: any[]) {
    this.coder.unaryOperator('not', () => {
      this.createLikeComparison(this.node.left, this.node.right);
    });
  }
}

export class MatchEvaluator extends LikeComparisonEvaluator {
  static tags = ['match'];
  node: Syntax.MatchExpression;

  evaluate(...args: any[]) {
    const self = this;
    const generator = self.node.value ? generateExpression : generateFunction;
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
          },
        });
      });
    }

    function generateBody(valueGenerator: Target.BodyEntry) {
      const value = self.coder.createAnonymous();
      self.coder.statement(() => {
        self.coder.assignAnonymous(value, valueGenerator);
      });

      self.node.matches.forEach((match) => {
        self.coder.ifStatement(
          () => {
            self.createLikeComparison(
              () => { self.coder.retrieveAnonymous(value); },
              self.defer(match.pattern),
            );
          },
          () => {
            self.dispatch(match.statements);
            self.coder.returnStatement();
          },
          null,
        );
      });

      if (self.node.elseStatements.isEmpty()) {
        const exploder = self.coder.runtimeImport('matchNotExhaustive');
        self.coder.statement(() => {
          self.coder.call(exploder, []);
        });
        return;
      }

      self.dispatch(self.node.elseStatements);
    }
  }
}

class BasePatternEvaluator extends LikeComparisonEvaluator {
  createPatternTemplate(node: Syntax.Node) {
    switch (node.tag) {
      case 'objectPattern':
      case 'arrayPattern':
        new NestedPatternEvaluator(this, node).evaluate();
        break;
      case 'context':
        this.coder.write(this.coder.literal(true));
        break;
      default:
        if (Syntax.hasAnnotation(node, 'pattern/equality')) {
          this.createLikeComparison(
            () => {
              let localName = Syntax.getAnnotation(node, 'pattern/local');
              localName = this.coder.registerAnonymous(localName);
              this.coder.retrieveAnonymous(localName);
            },
            node,
          );
          return;
        }
        this.coder.write(this.defer(node));
    }
  }
}

export class PatternEvaluator extends BasePatternEvaluator {
  static tags = ['pattern'];
  node: Syntax.Pattern;

  evaluate(...args: any[]) {
    const defineName = this.getPatternDefineMethodName(this.node);
    const definePattern = this.coder.runtimeImport(defineName);
    this.coder.call(definePattern, [
      () => {
        this.coder.func({
          internalArgs: [Syntax.getAnnotation(this.node, 'pattern/local')],
          body: () => {
            this.coder.returnStatement(() => {
              this.createPatternTemplate(this.node.left);
            });
          },
        });
      },
    ]);
  }

  getPatternDefineMethodName(node: Syntax.Pattern) {
    const complexity = Syntax.getAnnotation(node, 'pattern/complexity');
    return complexity > cachedPatternThreshold ? 'defineCachedPattern'
      : 'definePattern';
  }
}

export class NestedPatternEvaluator extends BasePatternEvaluator {
  static tags = ['objectPattern', 'arrayPattern'];
  node: Syntax.CollectionPattern;

  evaluate(...args: any[]) {
    const self = this;
    let parentLocal = Syntax.getAnnotation(this.node, 'pattern/local');
    parentLocal = self.coder.registerAnonymous(parentLocal);

    const isObject = this.node instanceof Syntax.ObjectPattern;
    const containerCheckName = isObject ? 'isObject' : 'isArray';

    const expressions: Function[] = [];
    expressions.push(() => {
      const checker = self.coder.runtimeImport(containerCheckName);
      self.coder.call(checker, [() => {
        self.coder.retrieveAnonymous(parentLocal);
      }]);
    });

    this.node.elements.forEach((element) => {
      if (element instanceof Syntax.PatternElement) {
        pushElement(element);
      } else {
        expressions.push(self.defer(element));
      }
    });
    self.coder.writeAndGroup(expressions);

    function pushElement(element: Syntax.PatternElement) {
      if (element.value instanceof Syntax.Wildcard) {
        expressions.push(generatePropertyCheck(element));
        return;
      }

      if (Syntax.hasAnnotation(element.value, 'pattern/equality')) {
        expressions.push(
          generateEquality(element.value, self.defer(element.id)),
        );
        return;
      }

      expressions.push(
        generateNested(element, element.value, self.defer(element.id)),
      );
    }

    function generatePropertyCheck(element: Syntax.PatternElement) {
      return () => {
        self.coder.call(() => {
          self.coder.member(
            () => { self.coder.retrieveAnonymous(parentLocal); },
            self.coder.literal('hasOwnProperty'),
          );
        }, [self.defer(element.id)]);
      };
    }

    function generateEquality(elementValue: Syntax.Node,
      elementIndex: Target.BodyEntry) {
      if (elementValue instanceof Syntax.Literal) {
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
          elementIndex,
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
                  elementIndex,
                );
              },
            );
          },
          self.defer(elementValue),
        ]);
      };
    }
  }
}
