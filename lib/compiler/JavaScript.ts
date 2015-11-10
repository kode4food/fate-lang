/// <reference path="../Util.ts"/>
/// <reference path="../Types.ts"/>
/// <reference path="./Annotations.ts"/>

"use strict";

namespace Fate.Compiler.JavaScript {
  import mixin = Util.mixin;
  import hasAnnotation = Compiler.hasAnnotation;

  var jsonStringify = JSON.stringify;

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
    annotations: Annotations;
    firstAccess: { [index: string]: FirstAccess };
    snapshot: Function;
  }

  interface LoopOptions {
    name?: Name;
    value: Name;
    collection: BodyEntry;
    guard: BodyEntry;
    body: BodyEntry;
    annotations: Annotations;
  }

  interface FunctionOptions {
    internalId?: string;
    internalArgs?: Name[];
    contextArgs?: Name[];
    prolog?: BodyEntry;
    body: BodyEntry;
    annotations: Annotations;
  }

  interface Modification {
    ids: Ids,
    created: boolean
  }

  // presented operators are symbolic
  var operatorMap: StringMap = {
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

  function canLiteralBeInlined(literalValue: any) {
    var type = typeof literalValue;
    return ( type === 'string' && literalValue.length < 32 ) ||
             type === 'number' || type === 'boolean';
  }

  export class Globals {
    private globals: { [index: string]: number } = {}; // name -> nextId
    private generatedLiterals: { [index: string]: GlobalId } = {};
    private generatedImports: { [index: string]: GlobalId } = {};
    private generatedBuilders: { [index: string]: GlobalId } = {};
    private globalVars: string[] = [];

    public nextId(prefix: string) {
      var next = this.globals[prefix];
      if ( typeof next !== 'number' ) {
        next = 0;  // seed it
      }
      var id = prefix + next.toString(36);
      this.globals[prefix] = next + 1;
      return id;
    }

    public literal(literalValue: any) {
      var canonical = jsonStringify(literalValue);

      if ( canLiteralBeInlined(literalValue) ) {
        return canonical;
      }

      var id = this.generatedLiterals[canonical];
      if ( id ) {
        return id;
      }
      id = this.generatedLiterals[canonical] = this.nextId('l');

      this.globalVars.push(id + "=" + canonical);
      return id;
    }

    public runtimeImport(funcName: string) {
      var id = this.generatedImports[funcName];
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
      var funcId = this.runtimeImport(funcName);
      var key = funcId + "/" + literalIds.join('/');
      var id = this.generatedBuilders[key];
      if ( id ) {
        return id;
      }
      id = this.generatedBuilders[key] = this.nextId('b');
      this.globalVars.push(
        id + "=" + funcId + "(" + literalIds.join(',') + ")"
      );
      return id;
    }

    public toString() {
      if ( this.globalVars.length ) {
        return 'const ' + this.globalVars.join(',') + ';';
      }
      return '';
    }
  }

  export function createModule(globals: Globals) {
    // Keeps track of name -> local mappings throughout the nesting
    var locals: { [index: string]: number } = {}; // prefix -> nextId
    var names: NameIdsMap = {};  // name -> localId[]
    var scopeInfo = createScopeInfo();
    var nameStack: NameInfo[] = [];
    var selfName = 'c';
    var usesScratch = false;

    var writerStack: BodyEntries[] = [];
    var body: BodyEntries = [];

    return {
      registerAnonymous: registerAnonymous,
      createAnonymous: createAnonymous,
      assignAnonymous: assignAnonymous,
      retrieveAnonymous: retrieveAnonymous,
      assignResult: assignResult,
      self: self,
      member: writeMember,
      write: write,
      writeAndGroup: writeAndGroup,
      getter: getter,
      assignment: assignment,
      assignments: assignments,
      assignFromArray: assignFromArray,
      exports: exports,
      unaryOperator: unaryOperator,
      binaryOperator: binaryOperator,
      conditionalOperator: conditionalOperator,
      statement: statement,
      ifStatement: ifStatement,
      loopExpression: loopExpression,
      loopContinue: loopContinue,
      funcDecl: funcDeclaration,
      func: func,
      compoundExpression: compoundExpression,
      returnStatement: returnStatement,
      call: call,
      array: array,
      arrayAppend: arrayAppend,
      object: object,
      objectAssign: objectAssign,
      parens: parens,
      code: code,
      toString: toString
    };

    function nextId(prefix: string) {
      var next = locals[prefix];
      if ( typeof next !== 'number' ) {
        next = 0;  // seed it
      }
      var id = prefix + next;
      locals[prefix] = next + 1;
      return id;
    }

    function createScopeInfo(): ScopeInfo {
      return {
        annotations: null,
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

    function extendNames(names: NameIdsMap) {
      var result: NameIdsMap = {};
      Object.keys(names).forEach(function (name) {
        result[name] = [lastItem(names[name])];
      });
      return result;
    }

    function popLocalScope() {
      var info = nameStack.pop();
      names = info.names;
      scopeInfo = info.scopeInfo;
      usesScratch = info.usesScratch;
    }

    function popLocalScopeWithScratch() {
      // Pass scratch up and through
      var tmpScratch = usesScratch;
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
      var ids = names[name] || (names[name] = []);
      ids.push(nextId('v'));
      return lastItem(ids);
    }

    function localForRead(name: Name) {
      if ( !scopeInfo.firstAccess[name] ) {
        scopeInfo.firstAccess[name] = FirstAccess.Read;
      }
      var ids = names[name] || (names[name] = [nextId('v')]);
      return lastItem(ids);
    }

    function self() {
      write(selfName);
    }

    function getMemberIdentifier(name: string) {
      var match = /^(["'])([a-zA-Z_$][0-9a-zA-Z_$]*)\1$/.exec(name);
      if ( match && match[2] ) {
        return match[2];
      }
      return null;
    }

    function writeMember(object: BodyEntry, property: BodyEntry) {
      var propertyCode = code(property);
      var memberId = getMemberIdentifier(propertyCode);
      if ( memberId ) {
        write(object, '.', memberId);
        return
      }
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
      var name = ' ' + id;
      names[name] = [id];
      return name;
    }

    function createAnonymous() {
      var id = nextId('h');
      var name = ' ' + id;
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

    function popWriter(): Compiler.GeneratedCode {
      var result = body;
      body = writerStack.pop();
      return code(result);
    }

    function captureState(capturedBody: Function) {
      var myScopeInfo = scopeInfo.snapshot();
      var myNames = names;

      return function () {
        pushLocalScope();
        scopeInfo = myScopeInfo;
        names = myNames;
        capturedBody();
        popLocalScope();
      };
    }

    function write(...content: any[]) {
      var args = content.filter(function (arg) {
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

    function assignment(name: Name, body: BodyEntry) {
      assignments([[name, body]]);
    }

    function assignments(items: AssignmentItems) {
      items.forEach(function (item) {
        var name = item[0];
        var value = code(item[1]);

        var localName = localForWrite(name);
        write(localName, '=', value, ";");
      });
    }

    function assignFromArray(varNames: Names, arr: BodyEntry) {
      var anon = createAnonymous();

      var elements: BodyEntries = [];
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
        var name = item[0];
        var alias = item[1];

        var localName = localForRead(name);
        writeMember('x', globals.literal(alias));
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
      var isTrue = globals.runtimeImport('isTrue');
      var condCode = code(condition);
      var trueCode = code(trueVal);
      var falseCode = code(falseVal);
      write('(', isTrue, '(', condCode, ')?', trueCode, ':', falseCode, ')');
    }

    function statement(bodyCallback: BodyEntry) {
      write(code(bodyCallback), ';');
    }

    function ifStatement(condition: BodyEntry, thenBranch: BodyEntry,
                         elseBranch: BodyEntry) {
      var condWrapperName = 'isTrue';
      if ( !thenBranch ) {
        condWrapperName = 'isFalse';
        thenBranch = elseBranch;
        elseBranch = undefined;
      }

      var condWrapper = globals.runtimeImport(condWrapperName);
      var condCode = code(condition);
      var [thenCode, elseCode] = codeBranches(thenBranch, elseBranch);

      write('if(', condWrapper, '(', condCode, ')){');
      write(thenCode);
      write('}');

      if ( elseCode.length ) {
        write('else{');
        write(elseCode);
        write('}');
      }
    }

    // Code branches using static single assignment
    function codeBranches(...branches: BodyEntry[]) {
      var branchContent: string[] = [];

      // Step 1: Code the branches, gathering the assignments
      var originalNames = names;
      var modificationSets: NameModificationsMap = {};
      branches.forEach(function (branch, index) {
        names = extendNames(originalNames);
        branchContent[index] = branch ? code(branch) : "";
        Object.keys(names).forEach(function (key) {
          var created = !originalNames[key];
          if ( created || names[key].length > 1 ) {
            var modificationSet = modificationSets[key];
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

      // Step 2: Create Phi functions for each name
      Object.keys(modificationSets).forEach(function (key) {
        var parentIds = names[key] || [];
        var passthruId = parentIds.length ? lastItem(parentIds) : null;
        var sourceIds: Ids = [];
        var modificationSet = modificationSets[key];

        for ( var i = 0; i < branches.length; i++ ) {
          var modifications = modificationSet[i];
          if ( !modifications ) {
            sourceIds[i] = passthruId;
            continue;
          }

          var ids = modifications.ids.slice(modifications.created ? 0 : 1);
          parentIds = parentIds.concat(ids);
          sourceIds[i] = lastItem(ids);
        }
        names[key] = parentIds;

        var targetId = localForWrite(key);
        sourceIds.forEach(function (sourceId, index) {
          if ( !sourceId ) {
            return;
          }
          var content = [targetId, '=', sourceId, ';'].join('');
          branchContent[index] += content;
        });
      });

      return branchContent;
    }

    function loopExpression(options: LoopOptions) {
      var itemValue = options.value;
      var itemName = options.name;
      var collection = options.collection;
      var loopGuard = options.guard;
      var loopBody = options.body;

      var iteratorName = itemName ? 'createNamedIterator' : 'createIterator';
      var iterator = globals.runtimeImport(iteratorName);
      var iteratorContent = code(function () {
        write(iterator, '(', collection, ')');
      });

      var parentNames = names;
      pushLocalScope();
      scopeInfo.annotations = options.annotations;

      var contextArgs = [itemValue];
      if ( itemName ) {
        contextArgs.push(itemName);
      }
      var argNames = contextArgs.map(localForWrite);

      var bodyContent = code(function () {
        generate(loopBody);
      });

      var guardContent = code(function () {
        generate(loopGuard);
      });

      if ( itemName ) {
        var wrapper = globals.nextId('i');
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
      var functionId = localForWrite(name);
      write(functionId, '=');
      func(options);
      write(';');
    }

    function func(options: FunctionOptions) {
      var internalId = options.internalId;
      var internalArgs = options.internalArgs || [];
      var contextArgs = options.contextArgs || [];
      var funcProlog = options.prolog;
      var funcBody = options.body;

      var parentNames = names;
      pushLocalScope();
      scopeInfo.annotations = options.annotations;

      var localNames = contextArgs.map(localForRead);

      var bodyContent = code(function () {
        generate(funcBody);
      });

      var prologContent = code(function () {
        generate(funcProlog);
      });

      var argNames = internalArgs.concat(localNames);
      write('function');
      if ( internalId ) {
        write(' ' + internalId);
      }
      write('(', argNames.join(','), '){');
      if ( usesScratch ) {
        write('let _;');
      }
      write(prologContent);
      writeLocalVariables(parentNames, argNames);

      write(bodyContent);
      if ( usesScratch ) {
        write('return _;');
      }
      write('}');
      popLocalScope();
    }

    function writeLocalVariables(parentNames: NameIdsMap, argNames: Names) {
      var undefinedVars: Names = [];
      Object.keys(names).forEach(function (name) {
        var localNameIds = names[name];
        var localNameId = localNameIds[0];

        // All secondary locals are treated as undefined
        undefinedVars.push.apply(undefinedVars, localNameIds.slice(1));

        if ( isArgument(localNameId) || parentNames[name] ) {
          return;
        }

        var firstAccess = scopeInfo.firstAccess[name];
        var assignedEarly = firstAccess === FirstAccess.Write;
        if ( isAnonymous(name) || assignedEarly ) {
          undefinedVars.push(localNameId);
          return;
        }

        // pull the value from the global context
        write('let ', localNameId, '=');
        writeMember(self, globals.literal(name));
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

    function returnStatement(bodyCallback?: Function) {
      if ( bodyCallback === undefined ) {
        write('return;');
        return;
      }
      write('return ', bodyCallback, ';');
    }

    function call(funcId: Id|BodyEntry, args?: BodyEntries) {
      if ( !args ) {
        // Pass through local arguments (for function chaining)
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

      var literals: ObjectAssignmentItems = [];
      var expressions: ObjectAssignmentItems = [];

      items.forEach(function (item) {
        var target = item[2] ? expressions : literals;
        target.push(item);
      });

      if ( expressions.length ) {
        var dictVar = createAnonymous();
        var components: BodyEntries = [];

        components.push(function () {
          assignAnonymous(dictVar, writeLiterals);
        });

        expressions.forEach(function (item) {
          components.push(function () {
            var name = item[2] ? item[0] : globals.literal(item[0]);
            writeMember(dictVar, name);
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
      writeMember(dict, name);
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
}
