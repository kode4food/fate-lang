/** @flow */

import * as Syntax from '../syntax';
import { Coder } from '../target';

export interface Evaluator {
  coder: Coder;
  getDispatchEvaluator(): Evaluator;
}

export class NodeEvaluator implements Evaluator {
  static tags: string[];

  constructor(parent: Evaluator, node: Syntax.Node) {
    this.coder = parent.coder;
    this.parent = parent;
    this.node = node;
  }

  getDispatchEvaluator(): Evaluator {
    return this.parent.getDispatchEvaluator();
  }

  dispatch(node: Syntax.Node, ...args: any[]) {
    let dispatcher = this.getDispatchEvaluator();
    dispatcher.evaluate.apply(dispatcher, arguments);
  }

  defer(...args: any[]) {
    return () => this.dispatch.apply(this, args);
  }
}
