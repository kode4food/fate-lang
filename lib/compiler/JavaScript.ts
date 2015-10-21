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
  type NameIdMap = { [index: string]: Id };

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
    names: NameIdMap;
    scopeInfo: ScopeInfo;
    usesScratch: boolean;
  }

  interface ScopeInfo {
    annotations: Annotations;
    firstAccess: { [index: string]: FirstAccess };
    snapshot: Function;
  }

  interface LoopOptions {
    name: Name;
    value: Name;
    collection: BodyEntry;
    guard: BodyEntry;
    body: BodyEntry;
    annotations: Annotations;
  }

  interface FunctionOptions {
    name?: string;
    internalArgs?: Name[];
    contextArgs?: Name[];
    prolog?: BodyEntry;
    body: BodyEntry;
    annotations: Annotations;
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

    public canLiteralBeInlined(literalValue: any) {
      var type = typeof literalValue;
      return ( type === 'string' && literalValue.length < 16 ) ||
             type === 'number' || type === 'boolean';
    }

    public literal(literalValue: any) {
      var canonical = jsonStringify(literalValue);

      if ( this.canLiteralBeInlined(literalValue) ) {
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
      var funcNameQuoted = JSON.stringify(funcName);
      this.globalVars.push(
        [id, "=r.runtimeImport(", funcNameQuoted, ")"].join('')
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
    var names: NameIdMap = {};      // name -> localId
    var scopeInfo = createScopeInfo();
    var nameStack: NameInfo[] = [];
    var selfName = 'c';
    var usesScratch = false;

    var writerStack: BodyEntries[] = [];
    var body: BodyEntries = [];

    return {
      localForRetrieval: localForRetrieval,
      localForAssignment: localForAssignment,
      registerAnonymous: registerAnonymous,
      createAnonymous: createAnonymous,
      assignAnonymous: assignAnonymous,
      retrieveAnonymous: retrieveAnonymous,
      assignResult: assignResult,
      self: self,
      member: member,
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
      func: func,
      compoundExpression: compoundExpression,
      returnStatement: returnStatement,
      call: call,
      array: array,
      arrayAppend: arrayAppend,
      object: object,
      objectAssign: objectAssign,
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
      names = Object.create(names);
      usesScratch = false;
      scopeInfo = createScopeInfo();
    }

    function popLocalScope() {
      var info = nameStack.pop();
      names = info.names;
      scopeInfo = info.scopeInfo;
      usesScratch = info.usesScratch;
    }

    function localForAssignment(name: Name) {
      if ( !scopeInfo.firstAccess[name] ) {
        scopeInfo.firstAccess[name] = FirstAccess.Write;
      }
      return localForName(name);
    }

    function localForRetrieval(name: Name) {
      if ( !scopeInfo.firstAccess[name] ) {
        scopeInfo.firstAccess[name] = FirstAccess.Read;
      }
      return localForName(name);
    }

    function localForName(name: Name) {
      var willMutate = hasAnnotation(scopeInfo, 'mutation/' + name);

      var id = names[name];
      if ( id && (names.hasOwnProperty(name) || !willMutate) ) {
        return id;
      }

      id = names[name] = nextId('v');
      return id;
    }

    function self() {
      write(selfName);
    }

    function functionArguments() {
      write("arguments");
    }

    function member(object: BodyEntry, property: BodyEntry) {
      write(object, '[', property, ']');
    }

    function retrieveAnonymous(name: Name) {
      write(names[name]);
    }

    function assignAnonymous(name: Name, value: BodyEntry) {
      write(names[name], '=', value);
    }

    function registerAnonymous(id: string) {
      var name = ' ' + id;
      names[name] = id;
      return name;
    }

    function createAnonymous() {
      var id = nextId('h');
      var name = ' ' + id;
      names[name] = id;
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
      write("(");
      writeDelimited(items, "&&");
      write(")");
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
      write(localForRetrieval(name));
    }

    function assignment(name: Name, body: BodyEntry) {
      assignments([[name, body]]);
    }

    function assignments(items: AssignmentItems) {
      items.forEach(function (item) {
        var name = item[0];
        var value = code(item[1]);

        var localName = localForAssignment(name);
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
          write(localForAssignment(varName), '=', anon, '[', arrIndex, ']');
        });
      });

      compoundExpression(elements);
    }

    function exports(items: ModuleItems) {
      items.forEach(function (item) {
        var name = item[0];
        var alias = item[1];

        var localName = localForAssignment(name);
        write('x[', globals.literal(alias), ']=', localName, ';');
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
      var isTruthy = globals.runtimeImport('isTruthy');
      var condCode = code(condition);
      var trueCode = code(trueVal);
      var falseCode = code(falseVal);
      write('(', isTruthy, '(', condCode, ')?', trueCode, ':', falseCode, ')');
    }

    function statement(bodyCallback: BodyEntry) {
      write(code(bodyCallback), ';');
    }

    function ifStatement(condition: BodyEntry, thenBranch: BodyEntry,
                         elseBranch: BodyEntry) {
      var condWrapperName = 'isTruthy';
      if ( !thenBranch ) {
        condWrapperName = 'isFalsy';
        thenBranch = elseBranch;
        elseBranch = undefined;
      }
      var condWrapper = globals.runtimeImport(condWrapperName);
      var condCode = code(condition);
      var thenCode = code(thenBranch);
      write('if(', condWrapper, '(', condCode, ')){', thenCode, '}');
      if ( elseBranch ) {
        write('else{', code(elseBranch), '}');
      }
    }

    function loopExpression(options: LoopOptions) {
      var itemValue = options.value;
      var itemName = options.name;
      var collection = options.collection;
      var loopGuard = options.guard;
      var loopBody = options.body;
      var annotations = options.annotations;

      var loop = globals.runtimeImport('loop');

      call(loop, [
        collection,
        function () {
          func({
            contextArgs: [itemValue, itemName],
            prolog: loopGuard,
            body: loopBody,
            annotations: annotations
          });
        }
      ]);
    }

    function func(options: FunctionOptions) {
      var functionName = options.name;
      var internalArgs = options.internalArgs || [];
      var contextArgs = options.contextArgs || [];
      var funcProlog = options.prolog;
      var funcBody = options.body;

      var parentNames = names;
      pushLocalScope();
      scopeInfo.annotations = options.annotations;

      var localNames = contextArgs.map(localForRetrieval);

      var bodyContent = code(function () {
        generate(funcBody);
      });

      var prologContent = code(function () {
        generate(funcProlog);
      });

      var argNames = internalArgs.concat(localNames);
      write('function');
      if ( functionName ) {
        write(' ' + functionName);
      }
      write('(', argNames.join(','), '){');
      if ( usesScratch ) {
        write('var _;');
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

    function writeLocalVariables(parentNames: NameIdMap, argNames: Names) {
      var undefinedVars: Names = [];
      Object.keys(names).forEach(function (name) {
        var localName = names[name];
        if ( isArgument(localName) ) {
          return;
        }

        var firstAccess = scopeInfo.firstAccess[name];
        var assignedEarly = firstAccess === FirstAccess.Write;

        if ( isAnonymous(name) || assignedEarly ) {
          undefinedVars.push(localName);
        }
        else if ( parentNames[name] ) {
          // Local Assignments (inherit from parent)
          write('var ', localName, '=', parentNames[name], ';');
        }
        else {
          write('var ', localName, '=');
          write(self, '[', globals.literal(name), ']');
          write(';');
        }
      });

      if ( undefinedVars.length ) {
        write('var ', undefinedVars.join(','), ';');
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
            write(dictVar, '[', name, ']=', item[1]);
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
      write(dict, '[', name, ']=', value);
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
