/** @flow */

import * as Syntax from '../syntax';
import { Coder } from '../target';

export interface Evaluator {
  coder: Coder;
  evaluate(...args: any[]): void;
  getDispatchEvaluator(): Evaluator;
}

export class NodeEvaluator implements Evaluator {
  static tags: string[];
  coder: Coder;
  parent: Evaluator;

  constructor(parent: Evaluator) {
    this.coder = parent.coder;
    this.parent = parent;
  }

  // eslint-disable-next-line class-methods-use-this
  evaluate(...args: any[]) {
    throw new Error('Stupid Coder: NodeEvaluator is abstract');
  }

  getDispatchEvaluator(): Evaluator {
    return this.parent.getDispatchEvaluator();
  }

  dispatch(node: Syntax.Node, ...args: any[]) {
    const dispatcher = this.getDispatchEvaluator();
    dispatcher.evaluate(node, ...args);
  }

  defer(...args: any[]) {
    return () => this.dispatch(...args);
  }
}
