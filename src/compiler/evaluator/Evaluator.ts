"use strict";

import * as Syntax from '../syntax';
import { Coder } from '../target';

export abstract class Evaluator {
  public coder: Coder;

  public abstract evaluate(node: Syntax.Node): void;
  public abstract getRootEvaluator(): Evaluator;
}

export abstract class NodeEvaluator extends Evaluator {
  public static tags: string[] = [];

  constructor(public parent: Evaluator) {
    super();
    this.coder = parent.coder;
  }

  public getRootEvaluator(): Evaluator {
    return this.parent.getRootEvaluator();
  }

  public defer(...args: any[]) {
    let root = this.getRootEvaluator();
    return () => root.evaluate.apply(root, args);
  }
}
