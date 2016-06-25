"use strict";

import * as Syntax from '../syntax';
import { Coder } from '../target';

export abstract class Evaluator {
  public static tags: string[] = [];

  constructor(public parent: Evaluator, public coder?: Coder) {
    if ( !coder ) {
      this.coder = parent.coder;
    }
  }

  public abstract evaluate(node: Syntax.Node): void;

  public getRootEvaluator() {
    let parent: Evaluator = this;
    while ( parent.parent ) {
      parent = parent.parent;
    }
    return parent;
  }

  public defer(...args: any[]) {
    let root = this.getRootEvaluator();
    return () => root.evaluate.apply(root, args);
  }
}
