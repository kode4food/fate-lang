/** @flow */

import type { ResolverValue } from '../syntax';
import type { Literal, BodyEntries } from './index';

import * as Target from './index';
import { mixin, isArray } from '../../runtime';
import { Resolver } from '../syntax';

const jsonStringify = JSON.stringify;
const jsStringIdRegex = /^(["'])([$_a-zA-Z][$_a-zA-Z0-9]*)\1$/;
const anonIdRegex = /^ anon_[a-zA-Z0-9]+$/;

type GlobalId = Target.Id;
type NameIdsMap = { [index: string]: Target.Ids };
type Modifications = Modification[];
type NameModificationsMap = { [index: string]: Modifications };

const firstAccess = {
  Unknown: 0,
  Read: 1,
  Write: 2,
};

type FirstAccessValue = $Values<typeof firstAccess>;

type NameInfo = {
  names: NameIdsMap;
  scopeInfo: ScopeInfo;
  usesScratch: boolean;
}

type ScopeInfo = {
  firstAccess: { [index: string]: FirstAccessValue };
  snapshot(): ScopeInfo;
}

type Modification = {
  ids: Target.Ids;
  created: boolean;
}

// presented operators are symbolic
const operatorMap = {
  eq: '===',
  neq: '!==',
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
  add: '+',
  sub: '-',
  mul: '*',
  div: '/',
  mod: '%',
  not: '!',
  neg: '-',
  pos: '+',
};

const waiterMap: string[] = [];
waiterMap[Resolver.Value] = 'awaitValue';
waiterMap[Resolver.Any] = 'awaitAny';
waiterMap[Resolver.All] = 'awaitAll';

// various names
const selfName = 's';
const thisOrSelf = `this||${selfName}`;
const globalObjectName = 'c';
const exportsName = 'x';
const valueName = 'v';

const inlineLiteralTypes = ['number', 'string', 'boolean'];
const inlineLiteralMaxLength = 32;

function lastItem(arr: any[]) {
  return arr[arr.length - 1];
}

export function createCoder(): Target.Coder {
  const idCounters: { [index: string]: number } = {}; // prefix -> nextId

  const generatedLiterals: { [index: string]: GlobalId } = {};
  const generatedImports: { [index: string]: GlobalId } = {};
  const generatedBuilders: { [index: string]: GlobalId } = {};
  const globalVars: string[] = [];

  // keeps track of name -> local mappings throughout the nesting
  const nameStack: NameInfo[] = [];
  let names: NameIdsMap = {};
  let usesScratch = false;
  let scopeInfo = createScopeInfo();

  const writerStack: Target.BodyEntries[] = [];
  let body: Target.BodyEntries = [];

  return {
    selfName,
    globalObjectName,
    exportsName,
    valueName,
    literal,
    runtimeImport,
    builder,
    registerAnonymous,
    createAnonymous,
    assignAnonymous,
    retrieveAnonymous,
    createCounter,
    incrementCounter,
    assignResult,
    self,
    currentDirectory,
    args,
    globalObject,
    member,
    write,
    writeAndGroup,
    getter,
    assignment,
    assignments,
    exportAll,
    exports,
    unaryOperator,
    binaryOperator,
    isTrue,
    isFalse,
    and,
    or,
    not,
    conditional,
    statement,
    ifStatement,
    loopExpression,
    loopContinue,
    funcDeclaration,
    iife,
    generator,
    scope,
    func,
    waitFor,
    compoundExpression,
    returnStatement,
    emitStatement,
    call,
    array,
    object,
    parens,
    code,
    toString,
  };

  function nextId(prefix: string) {
    let next = idCounters[prefix];
    if (typeof next !== 'number') {
      next = 0; // seed it
    }
    const id = prefix + next.toString(36);
    idCounters[prefix] = next + 1;
    return id;
  }

  function literal(literalValue: any): Literal {
    let canonical: string;
    if (literalValue instanceof RegExp) {
      canonical = literalValue.toString();
    } else {
      canonical = jsonStringify(literalValue);
    }

    if (inlineLiteralTypes.indexOf(typeof literalValue) !== -1
        && canonical.length <= inlineLiteralMaxLength) {
      return canonical;
    }

    let id = generatedLiterals[canonical];
    if (id) {
      return id;
    }
    id = nextId('lit_');
    generatedLiterals[canonical] = id;
    globalVars.push(`${id}=${canonical}`);
    return id;
  }

  function runtimeImport(funcName: string) {
    let id = generatedImports[funcName];
    if (id) {
      return id;
    }
    id = nextId(`${funcName}_`);
    generatedImports[funcName] = id;
    globalVars.push(
      [id, '=r.', funcName].join(''),
    );
    return id;
  }

  function builder(funcName: string, ...literalIds: Target.Ids) {
    const funcId = runtimeImport(funcName);
    const key = `${funcId}/${literalIds.join('/')}`;
    let id = generatedBuilders[key];
    if (id) {
      return id;
    }
    id = nextId(`${funcName}_`);
    generatedBuilders[key] = id;
    globalVars.push(
      `${id}=${funcId}(${literalIds.join(',')})`,
    );
    return id;
  }

  function createScopeInfo(): ScopeInfo {
    return {
      firstAccess: {},
      snapshot() {
        return mixin({}, this);
      },
    };
  }

  function pushLocalScope() {
    nameStack.push({
      names,
      scopeInfo,
      usesScratch,
    });

    names = extendNames(names);
    usesScratch = false;
    scopeInfo = createScopeInfo();
  }

  function extendNames(namesMap: NameIdsMap) {
    const result: NameIdsMap = {};
    Object.keys(namesMap).forEach((name) => {
      result[name] = [lastItem(namesMap[name])];
    });
    return result;
  }


  function popLocalScope() {
    /* eslint-disable */
    const info = nameStack.pop();
    names = info.names;
    scopeInfo = info.scopeInfo;
    usesScratch = info.usesScratch;
  }

  function popLocalScopeWithScratch() {
    // pass scratch up and through
    const tmpScratch = usesScratch;
    popLocalScope();
    usesScratch = tmpScratch;
  }

  function nextIdForName(name: Target.Name) {
    if (typeof name !== 'string') {
      return nextId(`_${name}$`);
    }
    return nextId(`${name}$`);
  }

  function localForWrite(name: Target.Name) {
    if (isAnonymous(name)) {
      return names[name][0];
    }
    if (!scopeInfo.firstAccess[name]) {
      scopeInfo.firstAccess[name] = firstAccess.Write;
    }
    const ids = names[name] || (names[name] = []);
    ids.push(nextIdForName(name));
    return lastItem(ids);
  }

  function localForRead(name: Target.Name) {
    if (!scopeInfo.firstAccess[name]) {
      scopeInfo.firstAccess[name] = firstAccess.Read;
    }
    const ids = names[name] || (names[name] = [nextIdForName(name)]);
    return lastItem(ids);
  }

  function self() {
    write('(', thisOrSelf, ')');
  }

  function currentDirectory() {
    return literal('__dirname');
  }

  function args(startAt: number) {
    const slice = runtimeImport('sliceArray');
    write(slice, '(arguments,', `${startAt}`, ')');
  }

  function globalObject() {
    write(globalObjectName);
  }

  function member(object: Target.BodyEntry, property: Target.BodyEntry) {
    write(object, () => {
      const propertyCode = code(property);
      const idMatch = jsStringIdRegex.exec(propertyCode);
      if (idMatch) {
        write('.', idMatch[2]);
      } else {
        write('[', propertyCode, ']');
      }
    });
  }

  function getAnonymousId(name: Target.Name) {
    return lastItem(names[name]);
  }

  function retrieveAnonymous(name: Target.Name) {
    write(getAnonymousId(name));
  }

  function assignAnonymous(name: Target.Name, value: Target.BodyEntry) {
    write(getAnonymousId(name), '=', value);
  }

  function registerAnonymous(id: Target.Id): Target.Name {
    const name = ` ${id}`;
    names[name] = [id];
    return name;
  }

  function createAnonymous() {
    const id = nextId('anon_');
    const name = ` ${id}`;
    names[name] = [id];
    return name;
  }

  function isAnonymous(name: Target.Name) {
    return anonIdRegex.test(name);
  }

  function createCounter(id: Target.Id) {
    write('let ', id, '=0;');
  }

  function incrementCounter(id: Target.Id) {
    write('(', id, '++)');
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
    const result = body;
    body = writerStack.pop();
    return code(result);
  }

  function captureState(capturedBody: Function) {
    const myScopeInfo = scopeInfo.snapshot();
    const myNames = names;

    return () => {
      pushLocalScope();
      scopeInfo = myScopeInfo;
      names = myNames;
      capturedBody();
      popLocalScope();
    };
  }

  function write(...content: any[]) {
    const args = content.filter(
      arg => arg !== undefined && arg !== null,
    );
    args.forEach((arg) => {
      if (typeof arg === 'function') {
        body.push(captureState(arg));
      } else {
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
    if (delimiter === undefined) {
      delimiter = ',';
    }
    items.forEach((item, i) => {
      if (i > 0) {
        write(delimiter);
      }
      write(item);
    });
  }

  function generate(value: Target.BodyEntry) {
    if (typeof value !== 'function') {
      write(value);
      return;
    }
    value();
  }

  function getter(name: Target.Name) {
    write(localForRead(name));
  }

  function assignment(name: Target.Name, bodyEntry: Target.BodyEntry) {
    assignments([[name, bodyEntry]]);
  }

  function assignments(items: Target.AssignmentItems) {
    items.forEach((item) => {
      const name = item[0];
      const value = code(item[1]);

      const localName = localForWrite(name);
      write(localName, '=', value, ';');
    });
  }

  function exportAll() {
    Object.keys(names).filter(name => !isAnonymous(name)).forEach((name) => {
      const localName = localForRead(name);
      member(exportsName, literal(name));
      write('=', localName, ';');
    });
  }

  function exports(items: Target.ModuleItems) {
    items.forEach((item) => {
      const name = item[0];
      const alias = item[1];

      const localName = localForRead(name);
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

  function isTrue(expr: Target.BodyEntry) {
    const anon = getAnonymousId(createAnonymous());
    write('(', anon, '=', expr, ',');
    write(anon, '!==false&&', anon, '!=null)');
  }

  function isFalse(expr: Target.BodyEntry) {
    const anon = getAnonymousId(createAnonymous());
    write('(', anon, '=', expr, ',');
    write(anon, '===false||', anon, '==null)');
  }

  function and(left: Target.BodyEntry, right: Target.BodyEntry) {
    const anon = getAnonymousId(createAnonymous());
    write('(', anon, '=', left, ',');
    write(anon, '!==false&&', anon, '!=null?');
    write(right, ':', anon, ')');
  }

  function or(left: Target.BodyEntry, right: Target.BodyEntry) {
    const anon = getAnonymousId(createAnonymous());
    write('(', anon, '=', left, ',');
    write(anon, '===false||', anon, '==null?');
    write(right, ':', anon, ')');
  }

  function not(expr: Target.BodyEntry) {
    write('(!');
    isTrue(expr);
    write(')');
  }

  function conditional(condition: Target.BodyEntry, trueVal: Target.BodyEntry,
                       falseVal: Target.BodyEntry) {
    const condCode = code(condition);
    const trueCode = code(trueVal);
    const falseCode = code(falseVal);

    const anon = getAnonymousId(createAnonymous());
    write('(', anon, '=', condCode, ',');
    write(anon, '!==false&&', anon, '!=null?');
    write(trueCode, ':', falseCode, ')');
  }

  function statement(bodyCallback: Target.BodyEntry) {
    write(code(bodyCallback), ';');
  }

  function ifStatement(condition: Target.BodyEntry,
                       thenBranch: Target.BodyEntry,
                       elseBranch: Target.BodyEntry) {
    let condWrapper = isTrue;
    if (!thenBranch) {
      condWrapper = isFalse;
      thenBranch = elseBranch;
      elseBranch = undefined;
    }

    const condCode = code(condition);
    const [thenCode, elseCode] = codeBranches(thenBranch, elseBranch);

    write('if');
    condWrapper(condCode);
    write('{', thenCode, '}');

    if (elseCode.length) {
      write('else{', elseCode, '}');
    }
  }

  // code branches using static single assignment
  function codeBranches(...branches: BodyEntries) {
    const branchContent: BodyEntries = [];

    // step 1: Code the branches, gathering the assignments
    const originalNames = names;
    const modificationSets: NameModificationsMap = {};
    branches.forEach((branch, index) => {
      names = extendNames(originalNames);
      branchContent[index] = branch ? code(branch) : '';
      Object.keys(names).forEach((key) => {
        const created = !originalNames[key];
        if (created || names[key].length > 1) {
          let modificationSet = modificationSets[key];
          if (!modificationSet) {
            modificationSet = modificationSets[key] = [];
          }

          modificationSet[index] = {
            ids: names[key],
            created,
          };
        }
      });
    });
    names = originalNames;

    // step 2: Create Phi functions for each name
    Object.keys(modificationSets).forEach((key) => {
      let parentIds = names[key] || [];
      const passthruId = parentIds.length ? lastItem(parentIds) : null;
      const sourceIds: Target.Ids = [];
      const modificationSet = modificationSets[key];

      for (let i = 0; i < branches.length; i += 1) {
        const modifications = modificationSet[i];
        if (!modifications) {
          sourceIds[i] = passthruId;
          continue;
        }

        const ids = modifications.ids.slice(modifications.created ? 0 : 1);
        parentIds = parentIds.concat(ids);
        sourceIds[i] = lastItem(ids);
      }
      names[key] = parentIds;

      const targetId = localForWrite(key);
      sourceIds.forEach((sourceId, index) => {
        if (!sourceId || sourceId === targetId) {
          return;
        }
        const content = [targetId, '=', sourceId, ';'].join('');
        branchContent[index] += content;
      });
    });

    return branchContent;
  }

  function loopExpression(options: Target.LoopOptions) {
    const {
      name, value, collection, body,
    } = options;
    const loopGuard = options.guard;

    const iterator = runtimeImport('createIterator');
    const iteratorContent = code(() => {
      write(iterator, '(', collection, ')');
    });

    const parentNames = names;
    pushLocalScope();

    const contextArgs = [value];
    if (name) {
      contextArgs.push(name);
    }
    const argNames = contextArgs.map(localForWrite);

    const bodyContent = code(() => {
      generate(body);
    });

    const guardContent = code(() => {
      generate(loopGuard);
    });

    const wrapper = nextId('iter_');
    write('for(let ', wrapper, ' of ', iteratorContent, '){');
    write('let ', argNames[0], '=', wrapper, '[0];');
    if (name) {
      write('let ', argNames[1], '=', wrapper, '[1];');
    }

    writeLocalVariables(parentNames, argNames);
    write(guardContent);
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
        const functionId = localForWrite(name);
        write(functionId, '=');
        func(options);
      });
    });
  }

  function iife(funcBody: Target.BodyEntry) {
    write('(');
    func({ body: funcBody });
    write('())');
  }

  function generator(funcBody: Target.BodyEntry) {
    write('(');
    func({ generator: true, body: funcBody });
    write('())');
  }

  function scope(scopeBody: Target.BodyEntry) {
    const parentNames = names;
    pushLocalScope();

    const bodyContent = code(() => {
      generate(scopeBody);
    });

    writeLocalVariables(parentNames, []);
    write(bodyContent);
    popLocalScopeWithScratch();
  }

  function func(options: Target.FunctionOptions) {
    const { internalId } = options;
    const internalArgs = options.internalArgs || [];
    const contextArgs = options.contextArgs || [];
    const isGenerator = options.generator;
    const funcBody = options.body;

    const parentNames = names;
    pushLocalScope();

    const localNames = contextArgs.map(localForRead);

    const bodyContent = code(() => {
      generate(funcBody);
    });

    const argNames = internalArgs.concat(localNames);
    write('function');
    if (isGenerator) {
      write('*');
    }
    if (internalId) {
      write(` ${internalId}`);
    }
    write('(', argNames.join(','), '){');
    if (usesScratch) {
      write('let _;');
    }

    writeLocalVariables(parentNames, argNames);
    write(bodyContent);

    if (usesScratch) {
      write('return _;');
    }
    write('}');
    popLocalScope();
  }

  function writeLocalVariables(parentNames: NameIdsMap,
                               argNames: Target.Names) {
    const undefinedVars: Target.Names = [];
    Object.keys(names).forEach((name) => {
      const localNameIds = names[name];
      const localNameId = localNameIds[0];

      // all secondary locals are treated as undefined
      undefinedVars.push(...localNameIds.slice(1));

      if (isArgument(localNameId) || parentNames[name]) {
        return;
      }

      undefinedVars.push(localNameId);
    });

    if (undefinedVars.length) {
      write('let ', undefinedVars.sort(compareVarNames).join(','), ';');
    }

    function isArgument(localName: Target.Name) {
      return argNames.indexOf(localName) !== -1;
    }
  }

  function compareVarNames(left: string, right: string) {
    const leftU = left.toUpperCase(); const
      rightU = right.toUpperCase();
    return leftU < rightU ? -1 : leftU > rightU ? 1 : 0;
  }

  function waitFor(resolver: ResolverValue, expression: Target.BodyEntry) {
    const resolverFuncName = waiterMap[resolver || Resolver.Value];
    const resolverFunc = runtimeImport(resolverFuncName);
    write('(yield [', resolverFunc, ',', expression, '])');
  }

  function compoundExpression(expressions: Target.BodyEntries) {
    write('(');
    writeDelimited(expressions);
    write(')');
  }

  function returnStatement(bodyCallback?: Target.BodyEntry) {
    if (bodyCallback) {
      write('return ', bodyCallback, ';');
      return;
    }
    write('return', (usesScratch ? ' _;' : ';'));
  }

  function emitStatement(bodyCallback: Target.BodyEntry) {
    write('yield ', bodyCallback, ';');
  }

  function call(funcId: Target.Id | Target.BodyEntry,
                args?: Target.BodyEntries) {
    if (!args) {
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

  function object(items: Target.ObjectAssignmentItems) {
    const literals: Target.ObjectAssignmentItems = [];
    const expressions: Target.ObjectAssignmentItems = [];

    items.forEach((item) => {
      const target = typeof item[0] === 'function' ? expressions : literals;
      target.push(item);
    });

    if (expressions.length) {
      const dictVar = createAnonymous();
      const components: Target.BodyEntries = [];

      components.push(() => {
        assignAnonymous(dictVar, writeLiterals);
      });

      expressions.forEach((item) => {
        components.push(() => {
          member(dictVar, item[0]);
          write('=', item[1]);
        });
      });

      components.push(() => {
        retrieveAnonymous(dictVar);
      });

      compoundExpression(components);
    } else {
      writeLiterals();
    }

    function writeLiterals() {
      write('{');
      literals.forEach((item, i) => {
        if (i > 0) {
          write(',');
        }
        write(jsonStringify(item[0]), ':', item[1]);
      });
      write('}');
    }
  }

  function parens(expr: Target.BodyEntry) {
    write('(', expr, ')');
  }

  function code(value: Target.BodyEntry | Target.BodyEntries): string {
    if (typeof value === 'function') {
      pushWriter();
      value();
      return popWriter();
    }

    if (isArray(value)) {
      return value.map(code).join('');
    }

    if (value === null) {
      return '';
    }
    return `${value}`;
  }

  function toString() {
    const buffer: string[] = [];

    // can't know all globals until body content is generated
    const bodyContent = code(body);

    if (globalVars.length) {
      buffer.push(`const ${globalVars.join(',')};`);
    }

    buffer.push(bodyContent);
    return buffer.join('');
  }
}
