/** @flow */

import * as Target from '../target';
import * as Syntax from '../syntax';
import { NodeEvaluator } from './evaluator';
import {RegexEvaluator} from "./pattern";

class ImportExportEvaluator extends NodeEvaluator {
  createImporterArguments() {
    this.coder.member(
      () => { this.coder.globalObject(); },
      this.coder.currentDirectory()
    );
  }
}

export class ImportEvaluator extends ImportExportEvaluator {
  node: Syntax.ImportStatement;

  evaluate() {
    let assigns: Target.AssignmentItems = [];
    this.node.modules.forEach(module => {
      let moduleName = module.path.value;
      let moduleAlias = module.alias.value;

      let moduleNameId = this.coder.literal(moduleName);
      let importer = this.coder.builder('importer', moduleNameId);

      assigns.push([
        moduleAlias,
        () => {
          this.coder.call(importer, [this.createImporterArguments.bind(this)]);
        }
      ]);
    });
    this.coder.assignments(assigns);
  }
}
ImportEvaluator.tags = ['import'];

export class FromEvaluator extends ImportExportEvaluator {
  node: Syntax.FromStatement;

  evaluate() {
    let assigns: any[] = [];
    let modulePath = this.node.path.value;
    let modulePathId = this.coder.literal(modulePath);
    let importer = this.coder.builder('importer', modulePathId);

    let anon = this.coder.createAnonymous();
    assigns.push([
      anon,
      () => {
        this.coder.call(importer, [this.createImporterArguments.bind(this)]);
      }
    ]);

    this.node.importList.forEach(item => {
      assigns.push([
        item.id.value,
        () => {
          this.coder.member(
            () => {
              this.coder.retrieveAnonymous(anon);
            },
            this.coder.literal(item.moduleKey.value)
          );
        }
      ]);
    });

    this.coder.assignments(assigns);
  }
}
FromEvaluator.tags = ['from'];

export class ExportEvaluator extends ImportExportEvaluator {
  node: Syntax.ExportStatement;

  evaluate() {
    let exportItems = this.node.exportItems;
    if ( !exportItems.length ) {
      this.coder.exportAll();
      return;
    }

    this.coder.exports(exportItems.map(item => {
      let name = item.id.value;
      let alias = item.moduleKey.value;
      return [name, alias];
    }));
  }
}
ExportEvaluator.tags = ['export'];
