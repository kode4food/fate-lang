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
  node: Syntax.Node;

  constructor(parent: Evaluator, node: Syntax.Node) {
    this.coder = parent.coder;
    this.parent = parent;
    this.node = node;
  }

  evaluate(...args: any[]) {
    throw new Error("Stupid Coder: NodeEvaluator is abstract");
  }

  getDispatchEvaluator(): Evaluator {
    return this.parent.getDispatchEvaluator();
  }

  dispatch(node: Syntax.Node, ...args: any[]) {
    const dispatcher = this.getDispatchEvaluator();
    dispatcher.evaluate(...arguments);
  }

  defer(...args: any[]) {
    return () => this.dispatch.apply(this, args);
  }
}
