"use strict";

import * as Target from '../target';
import * as Syntax from '../syntax';
import { NodeEvaluator } from './Evaluator';

abstract class ImportExportEvaluator extends NodeEvaluator {
  public createImporterArguments() {
    this.coder.member(
      () => { this.coder.globalObject(); },
      this.coder.currentDirectory()
    );
  }
}

export class ImportEvaluator extends ImportExportEvaluator {
  public static tags = ['import'];
  public node: Syntax.ImportStatement;

  public evaluate() {
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

export class FromEvaluator extends ImportExportEvaluator {
  public static tags = ['from'];
  public node: Syntax.FromStatement;

  public evaluate() {
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

export class ExportEvaluator extends ImportExportEvaluator {
  public static tags = ['export'];
  public node: Syntax.ExportStatement;

  public evaluate() {
    let exports = this.node.exportItems.map(item => {
      let name = item.id.value;
      let alias = item.moduleKey.value;
      return <Target.ModuleItem>[name, alias];
    });

    this.coder.exports(exports);
  }
}
