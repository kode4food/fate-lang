"use strict";

import * as Syntax from '../syntax';
import { Coder } from '../target';

export abstract class Evaluator {
  public coder: Coder;
  public abstract evaluate(...args: any[]): void;
  public abstract getDispatchEvaluator(): Evaluator;
}

export abstract class NodeEvaluator extends Evaluator {
  public static tags: Syntax.Tags = [];

  constructor(public parent: Evaluator, public node: Syntax.Node) {
    super();
    this.coder = parent.coder;
  }

  public getDispatchEvaluator(): Evaluator {
    return this.parent.getDispatchEvaluator();
  }

  public dispatch(node: Syntax.Node, ...args: any[]) {
    let dispatcher = this.getDispatchEvaluator();
    dispatcher.evaluate.apply(dispatcher, arguments);
  }

  public defer(...args: any[]) {
    return () => this.dispatch.apply(this, args);
  }
}
