/** @flow */

import type { Evaluator } from './evaluator';
import * as Target from '../target';
import * as Syntax from '../syntax';
import { NodeEvaluator } from './evaluator';

class ImportExportEvaluator extends NodeEvaluator {
  createImporterArguments() {
    this.coder.member(
      () => { this.coder.globalObject(); },
      this.coder.currentDirectory(),
    );
  }
}

export class ImportEvaluator extends ImportExportEvaluator {
  static tags = ['import'];
  node: Syntax.ImportStatement;

  constructor(parent: Evaluator, node: Syntax.ImportStatement) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    const assigns: Target.AssignmentItems = [];
    this.node.modules.forEach((module) => {
      const moduleName = module.path.value;
      const moduleAlias = module.alias.value;

      const moduleNameId = this.coder.literal(moduleName);
      const importer = this.coder.builder('importer', moduleNameId);

      assigns.push([
        moduleAlias,
        () => {
          this.coder.call(importer, [this.createImporterArguments.bind(this)]);
        },
      ]);
    });
    this.coder.assignments(assigns);
  }
}

export class FromEvaluator extends ImportExportEvaluator {
  static tags = ['from'];
  node: Syntax.FromStatement;

  constructor(parent: Evaluator, node: Syntax.FromStatement) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    const assigns: any[] = [];
    const modulePath = this.node.path.value;
    const modulePathId = this.coder.literal(modulePath);
    const importer = this.coder.builder('importer', modulePathId);

    const anon = this.coder.createAnonymous();
    assigns.push([
      anon,
      () => {
        this.coder.call(importer, [this.createImporterArguments.bind(this)]);
      },
    ]);

    this.node.importList.forEach((item) => {
      assigns.push([
        item.id.value,
        () => {
          this.coder.member(
            () => {
              this.coder.retrieveAnonymous(anon);
            },
            this.coder.literal(item.moduleKey.value),
          );
        },
      ]);
    });

    this.coder.assignments(assigns);
  }
}

export class ExportEvaluator extends ImportExportEvaluator {
  static tags = ['export'];
  node: Syntax.ExportStatement;

  constructor(parent: Evaluator, node: Syntax.ExportStatement) {
    super(parent);
    this.node = node;
  }

  evaluate(...args: any[]) {
    const { exportItems } = this.node;
    if (!exportItems.length) {
      this.coder.exportAll();
      return;
    }

    this.coder.exports(exportItems.map((item) => {
      const name = item.id.value;
      const alias = item.moduleKey.value;
      return [name, alias];
    }));
  }
}
