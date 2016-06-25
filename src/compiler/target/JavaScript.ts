"use strict";

import * as Target from './index';
import { mixin } from '../../runtime';
import { Resolver } from '../syntax';

const isArray = Array.isArray;
const jsonStringify = JSON.stringify;
const jsStringIdRegex = /^(["'])([$_a-zA-Z][$_a-zA-Z0-9]*)\1$/;
const anonIdRegex = /^ anon_[a-zA-Z0-9]+$/;

type StringMap = { [index: string]: string };

type GlobalId = Target.Id;
type NameIdsMap = { [index: string]: Target.Ids };
type Modifications = Modification[];
type NameModificationsMap = { [index: string]: Modifications };
type FunctionNameMap = { [index: string]: string };

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

interface Modification {
  ids: Target.Ids;
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
const thisOrSelf = 'this||' + selfName;
const contextName = 'c';
const exportsName = 'x';
const valueName = 'v';

const inlineLiteralTypes = ['number', 'string', 'boolean'];
const inlineLiteralMaxLength = 32;

function lastItem(arr: any[]) {
  return arr[arr.length - 1];
}

export function createCoder(): Target.Coder {
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

  let writerStack: Target.BodyEntries[] = [];
  let body: Target.BodyEntries = [];

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

  function builder(funcName: string, ...literalIds: Target.Ids) {
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

  function nextIdForName(name: Target.Name) {
    if ( typeof name !== 'string' ) {
      return nextId('_' + name + '$');
    }
    return nextId(name + '$');
  }

  function localForWrite(name: Target.Name) {
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

  function localForRead(name: Target.Name) {
    if ( !scopeInfo.firstAccess[name] ) {
      scopeInfo.firstAccess[name] = FirstAccess.Read;
    }
    let ids = names[name] || (names[name] = [nextIdForName(name)]);
    return lastItem(ids);
  }

  function self() {
    write('(', thisOrSelf, ')');
  }

  function currentDirectory() {
    return literal('__dirname');
  }

  function args(startAt: number) {
    let slice = runtimeImport('sliceArray');
    write(slice, '(arguments,', '' + startAt, ')');
  }

  function context() {
    write(contextName);
  }

  function member(object: Target.BodyEntry, property: Target.BodyEntry) {
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

  function retrieveAnonymous(name: Target.Name) {
    write(lastItem(names[name]));
  }

  function assignAnonymous(name: Target.Name, value: Target.BodyEntry) {
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

  function isAnonymous(name: Target.Name) {
    return anonIdRegex.test(name);
  }

  function assignResult(value: Target.BodyEntry) {
    usesScratch = true;
    write('_', '=', value);
  }

  function pushWriter() {
    writerStack.push(body);
    body = [];
  }

  function popWriter(): Target.GeneratedCode {
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

  function writeAndGroup(items: Target.BodyEntries) {
    write('(');
    writeDelimited(items, '&&');
    write(')');
  }

  function writeDelimited(items: Target.BodyEntries, delimiter?: string) {
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

  function generate(value: Target.BodyEntry) {
    if ( typeof value !== 'function' ) {
      write(value);
      return;
    }
    (<Function>value)();
  }

  function getter(name: Target.Name) {
    write(localForRead(name));
  }

  function assignment(name: Target.Name, bodyEntry: Target.BodyEntry) {
    assignments([[name, bodyEntry]]);
  }

  function assignments(items: Target.AssignmentItems) {
    items.forEach(item => {
      let name = item[0];
      let value = code(item[1]);

      let localName = localForWrite(name);
      write(localName, '=', value, ";");
    });
  }

  function exports(items: Target.ModuleItems) {
    items.forEach(item => {
      let name = item[0];
      let alias = item[1];

      let localName = localForRead(name);
      member(exportsName, literal(alias));
      write('=', localName, ';');
    });
  }

  function unaryOperator(operator: string, operand: Target.BodyEntry) {
    write('(', operatorMap[operator], '(', code(operand), '))');
  }

  function binaryOperator(operator: string, left: Target.BodyEntry,
                          right: Target.BodyEntry) {
    write('(', code(left), operatorMap[operator], code(right), ')');
  }

  function conditionalOperator(condition: Target.BodyEntry,
                               trueVal: Target.BodyEntry,
                               falseVal: Target.BodyEntry) {
    let isTrue = runtimeImport('isTrue');
    let condCode = code(condition);
    let trueCode = code(trueVal);
    let falseCode = code(falseVal);
    write('(', isTrue, '(', condCode, ')?', trueCode, ':', falseCode, ')');
  }

  function statement(bodyCallback: Target.BodyEntry) {
    write(code(bodyCallback), ';');
  }

  function ifStatement(condition: Target.BodyEntry,
                       thenBranch: Target.BodyEntry,
                       elseBranch: Target.BodyEntry) {
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
  function codeBranches(...branches: Target.BodyEntry[]) {
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
      let sourceIds: Target.Ids = [];
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

  function loopExpression(options: Target.LoopOptions) {
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

  function funcDeclaration(name: Target.Name,
                           options: Target.FunctionOptions) {
    statement(() => {
      assignResult(() => {
        let functionId = localForWrite(name);
        write(functionId, '=');
        func(options);
      });
    });
  }

  function iife(funcBody: Target.BodyEntry) {
    parens(() => {
      call(() => {
        func({ body: funcBody });
      }, []);
    });
  }

  function scope(scopeBody: Target.BodyEntry) {
    let parentNames = names;
    pushLocalScope();

    let bodyContent = code(() => {
      generate(scopeBody);
    });

    writeLocalVariables(parentNames, []);
    write(bodyContent);
    popLocalScopeWithScratch();
  }

  function func(options: Target.FunctionOptions) {
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

  function writeLocalVariables(parentNames: NameIdsMap,
                               argNames: Target.Names) {
    let undefinedVars: Target.Names = [];
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

    function isArgument(localName: Target.Name) {
      return argNames.indexOf(localName) !== -1;
    }
  }

  function compareVarNames(left: string, right: string) {
    let leftU = left.toUpperCase(), rightU = right.toUpperCase();
    return leftU < rightU ? -1 : leftU > rightU ? 1 : 0;
  }

  function waitFor(resolver: Resolver, expression: Target.BodyEntry) {
    let resolverFuncName = waiterMap[resolver || Resolver.Value];
    let resolverFunc = runtimeImport(resolverFuncName);
    write('(yield [', resolverFunc, ',', expression, '])');
  }

  function compoundExpression(expressions: Target.BodyEntries) {
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

  function call(funcId: Target.Id|Target.BodyEntry,
                args?: Target.BodyEntries) {
    if ( !args ) {
      // pass through local arguments (for function chaining)
      write(funcId, '.apply(', thisOrSelf, ',arguments)');
      return;
    }
    write(funcId, '(');
    writeDelimited(args);
    write(')');
  }

  function array(items: Target.BodyEntries) {
    write('[');
    writeDelimited(items);
    write(']');
  }

  function arrayAppend(array: Target.Id, value: Target.BodyEntry) {
    write(array, '.push(', value, ')');
  }

  function object(items: Target.ObjectAssignmentItems) {
    let literals: Target.ObjectAssignmentItems = [];
    let expressions: Target.ObjectAssignmentItems = [];

    items.forEach(item => {
      let target = typeof item[0] === 'function' ? expressions : literals;
      target.push(item);
    });

    if ( expressions.length ) {
      let dictVar = createAnonymous();
      let components: Target.BodyEntries = [];

      components.push(() => {
        assignAnonymous(dictVar, writeLiterals);
      });

      expressions.forEach(item => {
        components.push(() => {
          member(dictVar, item[0]);
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

  function objectAssign(dict: Target.Id, name: Target.BodyEntry,
                        value: Target.BodyEntry) {
    member(dict, name);
    write('=', value);
  }

  function parens(expr: Target.BodyEntry) {
    write('(', expr, ')');
  }

  function code(value?: Target.BodyEntry|Target.BodyEntries): string {
    if ( typeof value === 'function' ) {
      pushWriter();
      (<Function>value)();
      return popWriter();
    }

    if ( isArray(value) ) {
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
