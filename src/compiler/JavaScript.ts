"use strict";

import { mixin } from '../Util';
import { GeneratedCode } from './Compiler';
import { Resolver } from './Syntax';

const jsonStringify = JSON.stringify;
const jsStringIdRegex = /^(["'])([$_a-zA-Z][$_a-zA-Z0-9]*)\1$/;
const anonIdRegex = /^ anon_[a-zA-Z0-9]+$/;

type StringMap = { [index: string]: string };

type Name = string;
type Names = Name[];
type Alias = Name;
type Id = string;
type Ids = Id[];
type GlobalId = Id;
type BodyEntries = BodyEntry[];
type NameIdsMap = { [index: string]: Ids };
type Modifications = Modification[];
type NameModificationsMap = { [index: string]: Modifications };
type FunctionNameMap = { [index: string]: string };

export type BodyEntry = string|Function;
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
  generator?: boolean;
  body: BodyEntry;
}

interface Modification {
  ids: Ids;
  created: boolean;
}

// presented operators are symbolic
const operatorMap: StringMap = {
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

const waiterMap: FunctionNameMap = {};
waiterMap[Resolver.Value] = 'awaitValue';
waiterMap[Resolver.Any] = 'awaitAny';
waiterMap[Resolver.All] = 'awaitAll';

// various names
const selfName = 's';
const contextName = 'c';
const exportsName = 'x';
const valueName = 'v';

const inlineLiteralTypes = ['number', 'string', 'boolean'];
const inlineLiteralMaxLength = 32;

function lastItem(arr: any[]) {
  return arr[arr.length - 1];
}

export function createModule() {
  let idCounters: { [index: string]: number } = {}; // prefix -> nextId

  let generatedLiterals: { [index: string]: GlobalId } = {};
  let generatedImports: { [index: string]: GlobalId } = {};
  let generatedBuilders: { [index: string]: GlobalId } = {};
  let globalVars: string[] = [];

  // keeps track of name -> local mappings throughout the nesting
  let names: NameIdsMap = {};  // name -> localId[]
  let scopeInfo = createScopeInfo();
  let nameStack: NameInfo[] = [];
  let usesScratch = false;

  let writerStack: BodyEntries[] = [];
  let body: BodyEntries = [];

  return {
    selfName, contextName, exportsName, valueName,
    literal, runtimeImport, builder, registerAnonymous,
    createAnonymous, assignAnonymous, retrieveAnonymous,
    assignResult, self, currentDirectory, args, context,
    member, write, writeAndGroup, getter, assignment,
    assignments, exports, unaryOperator, binaryOperator,
    conditionalOperator, statement, ifStatement,
    loopExpression, loopContinue, funcDeclaration, iife,
    scope, func, waitFor, compoundExpression, returnStatement,
    call, array, arrayAppend, object, objectAssign, parens,
    code, toString
  };

  function nextId(prefix: string) {
    let next = idCounters[prefix];
    if ( typeof next !== 'number' ) {
      next = 0;  // seed it
    }
    let id = prefix + next.toString(36);
    idCounters[prefix] = next + 1;
    return id;
  }

  function literal(literalValue: any) {
    let canonical: string;
    if ( literalValue instanceof RegExp ) {
      canonical = literalValue.toString();
    }
    else {
      canonical = jsonStringify(literalValue);
    }

    if ( inlineLiteralTypes.indexOf(typeof literalValue) !== -1 &&
         canonical.length <= inlineLiteralMaxLength ) {
      return canonical;
    }

    let id = generatedLiterals[canonical];
    if ( id ) {
      return id;
    }
    id = generatedLiterals[canonical] = nextId('lit_');

    globalVars.push(`${id}=${canonical}`);
    return id;
  }

  function runtimeImport(funcName: string) {
    let id = generatedImports[funcName];
    if ( id ) {
      return id;
    }
    id = generatedImports[funcName] = nextId(funcName + '_');
    globalVars.push(
      [id, "=r.", funcName].join('')
    );
    return id;
  }

  function builder(funcName: string, ...literalIds: Ids) {
    let funcId = runtimeImport(funcName);
    let key = `${funcId}/${literalIds.join('/')}`;
    let id = generatedBuilders[key];
    if ( id ) {
      return id;
    }
    id = generatedBuilders[key] = nextId(funcName + '_');
    globalVars.push(
      `${ id }=${ funcId }(${ literalIds.join(',') })`
    );
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
    Object.keys(namesMap).forEach(name => {
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

  function nextIdForName(name: Name) {
    if ( typeof name !== 'string' ) {
      return nextId('_' + name + '$');
    }
    return nextId(name + '$');
  }

  function localForWrite(name: Name) {
    if ( isAnonymous(name) ) {
      return names[name][0];
    }
    if ( !scopeInfo.firstAccess[name] ) {
      scopeInfo.firstAccess[name] = FirstAccess.Write;
    }
    let ids = names[name] || (names[name] = []);
    ids.push(nextIdForName(name));
    return lastItem(ids);
  }

  function localForRead(name: Name) {
    if ( !scopeInfo.firstAccess[name] ) {
      scopeInfo.firstAccess[name] = FirstAccess.Read;
    }
    let ids = names[name] || (names[name] = [nextIdForName(name)]);
    return lastItem(ids);
  }

  function self() {
    write(selfName);
  }

  function currentDirectory() {
    return literal('__dirname');
  }

  function args(startAt = 0) {
    let slice = runtimeImport('sliceArray');
    write(slice, '(arguments,', '' + startAt, ')');
  }

  function context() {
    write(contextName);
  }

  function member(object: BodyEntry, property: BodyEntry) {
    write(object, () => {
      let propertyCode = code(property);
      let idMatch = jsStringIdRegex.exec(propertyCode);
      if ( idMatch ) {
        write('.', idMatch[2]);
      }
      else {
        write('[', propertyCode, ']');
      }
    });
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
    let id = nextId('anon_');
    let name = ' ' + id;
    names[name] = [id];
    return name;
  }

  function isAnonymous(name: Name) {
    return anonIdRegex.test(name);
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

    return () => {
      pushLocalScope();
      scopeInfo = myScopeInfo;
      names = myNames;
      capturedBody();
      popLocalScope();
    };
  }

  function write(...content: any[]) {
    let args = content.filter(
      arg => arg !== undefined && arg !== null
    );
    args.forEach(arg => {
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
    items.forEach((item, i) => {
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
    items.forEach(item => {
      let name = item[0];
      let value = code(item[1]);

      let localName = localForWrite(name);
      write(localName, '=', value, ";");
    });
  }

  function exports(items: ModuleItems) {
    items.forEach(item => {
      let name = item[0];
      let alias = item[1];

      let localName = localForRead(name);
      member(exportsName, literal(alias));
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
    let isTrue = runtimeImport('isTrue');
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

    let condWrapper = runtimeImport(condWrapperName);
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
    branches.forEach((branch, index) => {
      names = extendNames(originalNames);
      branchContent[index] = branch ? code(branch) : "";
       Object.keys(names).forEach(key => {
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
    Object.keys(modificationSets).forEach(key => {
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
      sourceIds.forEach((sourceId, index) => {
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
    let iterator = runtimeImport(iteratorName);
    let iteratorContent = code(() => {
      write(iterator, '(', collection, ')');
    });

    let parentNames = names;
    pushLocalScope();

    let contextArgs = [itemValue];
    if ( itemName ) {
      contextArgs.push(itemName);
    }
    let argNames = contextArgs.map(localForWrite);

    let bodyContent = code(() => {
      generate(loopBody);
    });

    let guardContent = code(() => {
      generate(loopGuard);
    });

    if ( itemName ) {
      let wrapper = nextId('iter_');
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
    statement(() => {
      assignResult(() => {
        let functionId = localForWrite(name);
        write(functionId, '=');
        func(options);
      });
    });
  }

  function iife(funcBody: BodyEntry) {
    parens(() => {
      call(() => {
        func({ body: funcBody });
      }, []);
    });
  }

  function scope(scopeBody: BodyEntry) {
    let parentNames = names;
    pushLocalScope();

    let bodyContent = code(() => {
      generate(scopeBody);
    });

    writeLocalVariables(parentNames, []);
    write(bodyContent);
    popLocalScopeWithScratch();
  }

  function func(options: FunctionOptions) {
    let internalId = options.internalId;
    let internalArgs = options.internalArgs || [];
    let contextArgs = options.contextArgs || [];
    let isGenerator = options.generator;
    let funcBody = options.body;

    let parentNames = names;
    pushLocalScope();

    let localNames = contextArgs.map(localForRead);

    let bodyContent = code(() => {
      generate(funcBody);
    });

    let argNames = internalArgs.concat(localNames);
    write('function');
    if ( isGenerator ) {
      write('*');
    }
    if ( internalId ) {
      write(' ' + internalId);
    }
    write('(', argNames.join(','), '){');
    if ( usesScratch ) {
      write('let _;');
    }

    writeLocalVariables(parentNames, argNames);
    write(bodyContent);

    if ( usesScratch ) {
      write('return _;');
    }
    write('}');
    popLocalScope();
  }

  function writeLocalVariables(parentNames: NameIdsMap, argNames: Names) {
    let undefinedVars: Names = [];
    Object.keys(names).forEach(name => {
      let localNameIds = names[name];
      let localNameId = localNameIds[0];

      // all secondary locals are treated as undefined
      undefinedVars.push.apply(undefinedVars, localNameIds.slice(1));

      if ( isArgument(localNameId) || parentNames[name] ) {
        return;
      }

      undefinedVars.push(localNameId);
    });

    if ( undefinedVars.length ) {
      write('let ', undefinedVars.sort(compareVarNames).join(','), ';');
    }

    function isArgument(localName: Name) {
      return argNames.indexOf(localName) !== -1;
    }
  }

  function compareVarNames(left: string, right: string) {
    let leftU = left.toUpperCase(), rightU = right.toUpperCase();
    return leftU < rightU ? -1 : leftU > rightU ? 1 : 0;
  }

  function waitFor(resolver: Resolver, expression: BodyEntry) {
    let resolverFuncName = waiterMap[resolver || Resolver.Value];
    let resolverFunc = runtimeImport(resolverFuncName);
    write('(yield [', resolverFunc, ',', expression, '])');
  }

  function compoundExpression(expressions: BodyEntries) {
    write('(');
    writeDelimited(expressions);
    write(')');
  }

  function returnStatement(bodyCallback?: Function) {
    if ( bodyCallback ) {
      write('return ', bodyCallback, ';');
      return;
    }
    write('return', (usesScratch ? ' _;' : ';'));
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
    let literals: ObjectAssignmentItems = [];
    let expressions: ObjectAssignmentItems = [];

    items.forEach(item => {
      item[2] = typeof item[0] === 'function';
      let target = item[2] ? expressions : literals;
      target.push(item);
    });

    if ( expressions.length ) {
      let dictVar = createAnonymous();
      let components: BodyEntries = [];

      components.push(() => {
        assignAnonymous(dictVar, writeLiterals);
      });

      expressions.forEach(item => {
        components.push(() => {
          let name = item[2] ? item[0] : literal(item[0]);
          member(dictVar, name);
          write('=', item[1]);
        });
      });

      components.push(() => {
        retrieveAnonymous(dictVar);
      });

      compoundExpression(components);
    }
    else {
      writeLiterals();
    }

    function writeLiterals() {
      write('{');
      literals.forEach((item, i) => {
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
    let buffer: string[] = [];

    // can't know all globals until body content is generated
    let bodyContent = code(body);

    if ( globalVars.length ) {
      buffer.push(`const ${ globalVars.join(',') };`);
    }

    buffer.push(bodyContent);
    return buffer.join('');
  }
}
