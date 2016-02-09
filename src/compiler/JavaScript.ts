"use strict";

import { mixin } from '../Util';
import { GeneratedCode } from './Compiler';

let jsonStringify = JSON.stringify;

type StringMap = { [index: string]: string };

type Name = string;
type Names = Name[];
type Alias = Name;
type Id = string;
type Ids = Id[];
type GlobalId = Id;
type BodyEntry = string|Function;
type BodyEntries = BodyEntry[];
type NameIdsMap = { [index: string]: Ids };
type Modifications = Modification[];
type NameModificationsMap = { [index: string]: Modifications };

export type AssignmentItem = [Name, BodyEntry];
export type AssignmentItems = AssignmentItem[];
export type ModuleItem = [Name, Alias];
export type ModuleItems = ModuleItem[];
export type ObjectAssignmentItem = [Name|BodyEntry, BodyEntry, boolean];
export type ObjectAssignmentItems = ObjectAssignmentItem[];

enum FirstAccess {
  Unknown = 0, Read = 1, Write = 2
}

interface NameInfo {
  names: NameIdsMap;
  scopeInfo: ScopeInfo;
  usesScratch: boolean;
}

interface ScopeInfo {
  firstAccess: { [index: string]: FirstAccess };
  snapshot: Function;
}

interface LoopOptions {
  name?: Name;
  value: Name;
  collection: BodyEntry;
  guard: BodyEntry;
  body: BodyEntry;
}

interface FunctionOptions {
  internalId?: string;
  internalArgs?: Name[];
  contextArgs?: Name[];
  prolog?: BodyEntry;
  body: BodyEntry;
}

interface Modification {
  ids: Ids;
  created: boolean;
}

// presented operators are symbolic
let operatorMap: StringMap = {
  'eq': '===',
  'neq': '!==',
  'gt': '>',
  'lt': '<',
  'gte': '>=',
  'lte': '<=',
  'add': '+',
  'sub': '-',
  'mul': '*',
  'div': '/',
  'mod': '%',
  'not': '!',
  'neg': '-',
  'pos': '+'
};

function lastItem(arr: any[]) {
  return arr[arr.length - 1];
}

export class Globals {
  private globals: { [index: string]: number } = {}; // name -> nextId
  private generatedLiterals: { [index: string]: GlobalId } = {};
  private generatedImports: { [index: string]: GlobalId } = {};
  private generatedBuilders: { [index: string]: GlobalId } = {};
  private globalVars: string[] = [];

  public nextId(prefix: string) {
    let next = this.globals[prefix];
    if ( typeof next !== 'number' ) {
      next = 0;  // seed it
    }
    let id = prefix + next.toString(36);
    this.globals[prefix] = next + 1;
    return id;
  }

  public literal(literalValue: any) {
    let canonical: string;
    if ( literalValue instanceof RegExp ) {
      canonical = literalValue.toString();
    }
    else {
      canonical = jsonStringify(literalValue);
    }
    let id = this.generatedLiterals[canonical];
    if ( id ) {
      return id;
    }
    id = this.generatedLiterals[canonical] = this.nextId('l');

    this.globalVars.push(`${id}=${canonical}`);
    return id;
  }

  public runtimeImport(funcName: string) {
    let id = this.generatedImports[funcName];
    if ( id ) {
      return id;
    }
    id = this.generatedImports[funcName] = this.nextId('r');
    this.globalVars.push(
      [id, "=r.", funcName].join('')
    );
    return id;
  }

  public builder(funcName: string, ...literalIds: Ids) {
    let funcId = this.runtimeImport(funcName);
    let key = `${funcId}/${literalIds.join('/')}`;
    let id = this.generatedBuilders[key];
    if ( id ) {
      return id;
    }
    id = this.generatedBuilders[key] = this.nextId('b');
    this.globalVars.push(
      `${ id }=${ funcId }(${ literalIds.join(',') })`
    );
    return id;
  }

  public toString() {
    if ( this.globalVars.length ) {
      return `const ${ this.globalVars.join(',') };`;
    }
    return '';
  }
}

export function createModule(globals: Globals) {
  // keeps track of name -> local mappings throughout the nesting
  let locals: { [index: string]: number } = {}; // prefix -> nextId
  let names: NameIdsMap = {};  // name -> localId[]
  let scopeInfo = createScopeInfo();
  let nameStack: NameInfo[] = [];
  let usesScratch = false;

  let writerStack: BodyEntries[] = [];
  let body: BodyEntries = [];

  // various names
  let selfName = 's';
  let contextName = 'c';
  let exportsName = 'x';

  return {
    registerAnonymous, createAnonymous, assignAnonymous,
    retrieveAnonymous, assignResult, self, selfName, context,
    contextName, member, write, writeAndGroup, getter, assignment,
    assignments, assignFromArray, exports, exportsName,
    unaryOperator, binaryOperator, conditionalOperator, statement,
    ifStatement, loopExpression, loopContinue, funcDeclaration,
    iife, func, compoundExpression, returnStatement, call, array,
    arrayAppend, object, objectAssign, parens, code, toString
  };

  function nextId(prefix: string) {
    let next = locals[prefix];
    if ( typeof next !== 'number' ) {
      next = 0;  // seed it
    }
    let id = prefix + next;
    locals[prefix] = next + 1;
    return id;
  }

  function createScopeInfo(): ScopeInfo {
    return {
      firstAccess: {},
      snapshot: function () {
        return mixin({}, this);
      }
    };
  }

  function pushLocalScope() {
    nameStack.push({
      names: names,
      scopeInfo: scopeInfo,
      usesScratch: usesScratch
    });

    names = extendNames(names);
    usesScratch = false;
    scopeInfo = createScopeInfo();
  }

  function extendNames(namesMap: NameIdsMap) {
    let result: NameIdsMap = {};
    Object.keys(namesMap).forEach(function (name) {
      result[name] = [lastItem(namesMap[name])];
    });
    return result;
  }

  function popLocalScope() {
    let info = nameStack.pop();
    names = info.names;
    scopeInfo = info.scopeInfo;
    usesScratch = info.usesScratch;
  }

  function popLocalScopeWithScratch() {
    // pass scratch up and through
    let tmpScratch = usesScratch;
    popLocalScope();
    usesScratch = tmpScratch;
  }

  function localForWrite(name: Name) {
    if ( isAnonymous(name) ) {
      return names[name][0];
    }
    if ( !scopeInfo.firstAccess[name] ) {
      scopeInfo.firstAccess[name] = FirstAccess.Write;
    }
    let ids = names[name] || (names[name] = []);
    ids.push(nextId('v'));
    return lastItem(ids);
  }

  function localForRead(name: Name) {
    if ( !scopeInfo.firstAccess[name] ) {
      scopeInfo.firstAccess[name] = FirstAccess.Read;
    }
    let ids = names[name] || (names[name] = [nextId('v')]);
    return lastItem(ids);
  }

  function self() {
    write(selfName);
  }

  function context() {
    write(contextName);
  }

  function member(object: BodyEntry, property: BodyEntry) {
    write(object, '[', property, ']');
  }

  function retrieveAnonymous(name: Name) {
    write(lastItem(names[name]));
  }

  function assignAnonymous(name: Name, value: BodyEntry) {
    retrieveAnonymous(name);
    write('=', value);
  }

  function registerAnonymous(id: string) {
    let name = ' ' + id;
    names[name] = [id];
    return name;
  }

  function createAnonymous() {
    let id = nextId('h');
    let name = ' ' + id;
    names[name] = [id];
    return name;
  }

  function isAnonymous(name: Name) {
    return (/ [a-z][0-9]*/).test(name);
  }

  function assignResult(value: BodyEntry) {
    usesScratch = true;
    write('_', '=', value);
  }

  function pushWriter() {
    writerStack.push(body);
    body = [];
  }

  function popWriter(): GeneratedCode {
    let result = body;
    body = writerStack.pop();
    return code(result);
  }

  function captureState(capturedBody: Function) {
    let myScopeInfo = scopeInfo.snapshot();
    let myNames = names;

    return function () {
      pushLocalScope();
      scopeInfo = myScopeInfo;
      names = myNames;
      capturedBody();
      popLocalScope();
    };
  }

  function write(...content: any[]) {
    let args = content.filter(function (arg) {
      return arg !== undefined && arg !== null;
    });
    args.forEach(function (arg) {
      if ( typeof arg === 'function' ) {
        body.push(captureState(arg));
      }
      else {
        body.push(arg);
      }
    });
  }

  function writeAndGroup(items: BodyEntries) {
    write('(');
    writeDelimited(items, '&&');
    write(')');
  }

  function writeDelimited(items: BodyEntries, delimiter?: string) {
    if ( delimiter === undefined ) {
      delimiter = ',';
    }
    items.forEach(function (item, i) {
      if ( i > 0 ) {
        write(delimiter);
      }
      write(item);
    });
  }

  function generate(value: BodyEntry) {
    if ( typeof value !== 'function' ) {
      write(value);
      return;
    }
    (<Function>value)();
  }

  function getter(name: Name) {
    write(localForRead(name));
  }

  function assignment(name: Name, bodyEntry: BodyEntry) {
    assignments([[name, bodyEntry]]);
  }

  function assignments(items: AssignmentItems) {
    items.forEach(function (item) {
      let name = item[0];
      let value = code(item[1]);

      let localName = localForWrite(name);
      write(localName, '=', value, ";");
    });
  }

  function assignFromArray(varNames: Names, arr: BodyEntry) {
    let anon = createAnonymous();

    let elements: BodyEntries = [];
    elements.push(function () {
      assignAnonymous(anon, arr);
    });

    varNames.forEach(function (varName, arrIndex) {
      elements.push(function () {
        write(localForWrite(varName), '=', anon, '[', arrIndex, ']');
      });
    });

    compoundExpression(elements);
  }

  function exports(items: ModuleItems) {
    items.forEach(function (item) {
      let name = item[0];
      let alias = item[1];

      let localName = localForRead(name);
      member(exportsName, globals.literal(alias));
      write('=', localName, ';');
    });
  }

  function unaryOperator(operator: string, operand: BodyEntry) {
    write('(', operatorMap[operator], '(', code(operand), '))');
  }

  function binaryOperator(operator: string, left: BodyEntry,
                          right: BodyEntry) {
    write('(', code(left), operatorMap[operator], code(right), ')');
  }

  function conditionalOperator(condition: BodyEntry, trueVal: BodyEntry,
                                falseVal: BodyEntry) {
    let isTrue = globals.runtimeImport('isTrue');
    let condCode = code(condition);
    let trueCode = code(trueVal);
    let falseCode = code(falseVal);
    write('(', isTrue, '(', condCode, ')?', trueCode, ':', falseCode, ')');
  }

  function statement(bodyCallback: BodyEntry) {
    write(code(bodyCallback), ';');
  }

  function ifStatement(condition: BodyEntry, thenBranch: BodyEntry,
                        elseBranch: BodyEntry) {
    let condWrapperName = 'isTrue';
    if ( !thenBranch ) {
      condWrapperName = 'isFalse';
      thenBranch = elseBranch;
      elseBranch = undefined;
    }

    let condWrapper = globals.runtimeImport(condWrapperName);
    let condCode = code(condition);
    let [thenCode, elseCode] = codeBranches(thenBranch, elseBranch);

    write('if(', condWrapper, '(', condCode, ')){');
    write(thenCode);
    write('}');

    if ( elseCode.length ) {
      write('else{');
      write(elseCode);
      write('}');
    }
  }

  // code branches using static single assignment
  function codeBranches(...branches: BodyEntry[]) {
    let branchContent: string[] = [];

    // step 1: Code the branches, gathering the assignments
    let originalNames = names;
    let modificationSets: NameModificationsMap = {};
    branches.forEach(function (branch, index) {
      names = extendNames(originalNames);
      branchContent[index] = branch ? code(branch) : "";
       Object.keys(names).forEach(function (key) {
        let created = !originalNames[key];
        if ( created || names[key].length > 1 ) {
          let modificationSet = modificationSets[key];
          if ( !modificationSet ) {
            modificationSet = modificationSets[key] = [];
          }

          modificationSet[index] = {
            ids: names[key],
            created: created
          };
        }
      });
    });
    names = originalNames;

    // step 2: Create Phi functions for each name
    Object.keys(modificationSets).forEach(function (key) {
      let parentIds = names[key] || [];
      let passthruId = parentIds.length ? lastItem(parentIds) : null;
      let sourceIds: Ids = [];
      let modificationSet = modificationSets[key];

      for ( let i = 0; i < branches.length; i++ ) {
        let modifications = modificationSet[i];
        if ( !modifications ) {
          sourceIds[i] = passthruId;
          continue;
        }

        let ids = modifications.ids.slice(modifications.created ? 0 : 1);
        parentIds = parentIds.concat(ids);
        sourceIds[i] = lastItem(ids);
      }
      names[key] = parentIds;

      let targetId = localForWrite(key);
      sourceIds.forEach(function (sourceId, index) {
        if ( !sourceId || sourceId === targetId ) {
          return;
        }
        let content = [targetId, '=', sourceId, ';'].join('');
        branchContent[index] += content;
      });
    });

    return branchContent;
  }

  function loopExpression(options: LoopOptions) {
    let itemValue = options.value;
    let itemName = options.name;
    let collection = options.collection;
    let loopGuard = options.guard;
    let loopBody = options.body;

    let iteratorName = itemName ? 'createNamedIterator' : 'createIterator';
    let iterator = globals.runtimeImport(iteratorName);
    let iteratorContent = code(function () {
      write(iterator, '(', collection, ')');
    });

    let parentNames = names;
    pushLocalScope();

    let contextArgs = [itemValue];
    if ( itemName ) {
      contextArgs.push(itemName);
    }
    let argNames = contextArgs.map(localForWrite);

    let bodyContent = code(function () {
      generate(loopBody);
    });

    let guardContent = code(function () {
      generate(loopGuard);
    });

    if ( itemName ) {
      let wrapper = globals.nextId('i');
      write('for(let ', wrapper, ' of ', iteratorContent, '){');
      write('let ', argNames[0], '=', wrapper, '[0],');
      write(argNames[1], '=', wrapper, '[1];');
    }
    else {
      write('for(let ', argNames[0], ' of ', iteratorContent, '){');
    }

    write(guardContent);
    writeLocalVariables(parentNames, argNames);
    write(bodyContent);
    write('}');

    popLocalScopeWithScratch();
  }

  function loopContinue() {
    write('continue;');
  }

  function funcDeclaration(name: Name, options: FunctionOptions) {
    let functionId = localForWrite(name);
    write(functionId, '=');
    func(options);
    write(';');
  }

  function iife(funcBody: BodyEntry) {
    parens(function () {
      call(function () {
        func({ body: funcBody });
      }, []);
    });
  }

  function func(options: FunctionOptions) {
    let internalId = options.internalId;
    let internalArgs = options.internalArgs || [];
    let contextArgs = options.contextArgs || [];
    let funcProlog = options.prolog;
    let funcBody = options.body;

    let parentNames = names;
    pushLocalScope();

    let localNames = contextArgs.map(localForRead);

    let bodyContent = code(function () {
      generate(funcBody);
    });

    let prologContent = code(function () {
      generate(funcProlog);
    });

    let argNames = internalArgs.concat(localNames);
    write('function');
    if ( internalId ) {
      write(' ' + internalId);
    }
    write('(', argNames.join(','), '){');
    if ( usesScratch ) {
      write('let _;');
    }

    writeLocalVariables(parentNames, argNames);
    write(prologContent);

    write(bodyContent);
    if ( usesScratch ) {
      write('return _;');
    }
    write('}');
    popLocalScope();
  }

  function writeLocalVariables(parentNames: NameIdsMap, argNames: Names) {
    let undefinedVars: Names = [];
    Object.keys(names).forEach(function (name) {
      let localNameIds = names[name];
      let localNameId = localNameIds[0];

      // all secondary locals are treated as undefined
      undefinedVars.push.apply(undefinedVars, localNameIds.slice(1));

      if ( isArgument(localNameId) || parentNames[name] ) {
        return;
      }

      let firstAccess = scopeInfo.firstAccess[name];
      let assignedEarly = firstAccess === FirstAccess.Write;
      if ( isAnonymous(name) || assignedEarly ) {
        undefinedVars.push(localNameId);
        return;
      }

      // pull the value from the global context
      write('let ', localNameId, '=');
      member(context, globals.literal(name));
      write(';');
    });

    if ( undefinedVars.length ) {
      write('let ', undefinedVars.join(','), ';');
    }

    function isArgument(localName: Name) {
      return argNames.indexOf(localName) !== -1;
    }
  }

  function compoundExpression(expressions: BodyEntries) {
    write('(');
    writeDelimited(expressions);
    write(')');
  }

  function returnStatement(bodyCallback: Function) {
    write('return ', bodyCallback, ';');
  }

  function call(funcId: Id|BodyEntry, args?: BodyEntries) {
    if ( !args ) {
      // pass through local arguments (for function chaining)
      write(funcId, '.apply(null,arguments)');
      return;
    }
    write(funcId, '(');
    writeDelimited(args);
    write(')');
  }

  function array(items: BodyEntries) {
    write('[');
    writeDelimited(items);
    write(']');
  }

  function arrayAppend(array: Id, value: BodyEntry) {
    write(array, '.push(', value, ')');
  }

  function object(items: ObjectAssignmentItems) {
    items = items.map(function (item) {
      item[2] = typeof item[0] === 'function';
      return item;
    });

    let literals: ObjectAssignmentItems = [];
    let expressions: ObjectAssignmentItems = [];

    items.forEach(function (item) {
      let target = item[2] ? expressions : literals;
      target.push(item);
    });

    if ( expressions.length ) {
      let dictVar = createAnonymous();
      let components: BodyEntries = [];

      components.push(function () {
        assignAnonymous(dictVar, writeLiterals);
      });

      expressions.forEach(function (item) {
        components.push(function () {
          let name = item[2] ? item[0] : globals.literal(item[0]);
          member(dictVar, name);
          write('=', item[1]);
        });
      });

      components.push(function () {
        retrieveAnonymous(dictVar);
      });

      compoundExpression(components);
    }
    else {
      writeLiterals();
    }

    function writeLiterals() {
      write('{');
      literals.forEach(function (item, i) {
        if ( i > 0 ) {
          write(',');
        }
        write(jsonStringify(item[0]), ':', item[1]);
      });
      write('}');
    }
  }

  function objectAssign(dict: Id, name: BodyEntry, value: BodyEntry) {
    member(dict, name);
    write('=', value);
  }

  function parens(expr: BodyEntry) {
    write('(', expr, ')');
  }

  function code(value?: BodyEntry|BodyEntries): string {
    if ( value === undefined ) {
      return code(body);
    }

    if ( typeof value === 'function' ) {
      pushWriter();
      (<Function>value)();
      return popWriter();
    }

    if ( Array.isArray(value) ) {
      return (<(any)[]>value).map(code).join('');
    }

    return '' + value;
  }

  function toString() {
    return code();
  }
}
