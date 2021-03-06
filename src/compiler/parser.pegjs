{
  const isFormatter = require('../runtime/Format').isFormatter;
  const Syntax = require('./syntax');
  const annotate = Syntax.annotate;

  function node() {
    let result = Syntax.node.apply(null, arguments);
    let loc = location();
    result.line = loc.start.line;
    result.column = loc.start.column;
    return result;
  }

  function buildBinaryChain(head, tail) {
    if ( !tail || !tail.length ) {
      return head;
    }

    tail.forEach(item => {
      item.left = head;
      head = item;
    });

    return head;
  }

  function statementsNode(arr) {
    if ( !arr ) {
      return node('statements', []);
    }
    return node('statements', arr.filter(value => value !== null));
  }

  function literalName(node) {
    return node.template('literal', node.value);
  }

  function reference(id) {
    annotate(id, 'id/reference');
    return id;
  }
}

start = module

/* Parser *******************************************************************/

module
  = __ stmts:moduleStatement* {
      return statementsNode(stmts);
    }

moduleStatement
  = s:exportStatement NL { return s; }
  / statement

statements
  = stmts:statement* {
      return statementsNode(stmts);
    }

statement
  = s:blockStatement NL {
      return s;
    }

blockStatement
  = conditionalStatement

conditionalStatement
  = trailingIfStatement
  / ifStatement
  / unconditionalStatement

unconditionalStatement
  = declStatement
  / forStatement
  / trailableStatement

trailableStatement
  = importStatement
  / letStatement
  / returnStatement
  / emitStatement
  / exprStatement

exprStatement
  = expr:expr {
      return node('expression', expr);
    }

declStatement
  = funcDeclaration

funcDeclaration
  = op:Def signature:signature stmts:statementsTail {
      return node(op, signature, stmts);
    }

signature
  = __ id:Identifier _ params:params? guard:guard? {
      return node('signature', id, params, guard);
    }

guard
  = __ Where __ expr:expr {
      return expr;
    }

statementsTail
  = NL stmts:statements End {
      return stmts;
    }
  / __ ":" __ stmt:blockStatement {
      return statementsNode([stmt]);
    }

params
  = "(" __ params:paramList __ ")" {
      return params;
    }
  / "(" __ ")" {
      return [];
    }

paramList
  = head:paramDef
    tail:( LIST_SEP param:paramDef { return param; } )* {
      return [head].concat(tail);
    }

paramDef
  = pattern:patternExpr alias:alias cardinality:paramCardinality? {
      return node('patternParam', alias, pattern, cardinality);
    }
  / pattern:patternExpr cardinality:paramCardinality? {
      if ( pattern.left.tag === 'id' ) {
        return node('idParam', pattern.left, cardinality);
      }
      return node('patternParam', null, pattern, cardinality);
    }

alias
  = AS_SEP id:Identifier {
      return id;
    }

paramCardinality
  = _ '*' { return Syntax.Cardinality.ZeroToMany; }

patternExpr
  = expr:expr {
      return expr.template('pattern', expr);
    }

importStatement
  = op:From path:(modulePath / stringPath)
    __ Import __ imports:importModuleItems {
      return node(op, path, imports);
    }
  / op:Import __ modules:moduleSpecifiers {
      return node(op, modules);
    }

stringPath
  = __ path:SimpleString {
      return node('modulePath', path.value);
    }

modulePath
  = __ head:moduleComp tail:( "." item:moduleComp { return item; } )* {
      return node('modulePath', [head].concat(tail).join('/'));
    }

moduleComp
  = !ReservedWord name:Name {
      return name.value;
    }

importModuleItems
  = head:importModuleItem
    tail:( LIST_SEP item:importModuleItem { return item; } )* {
      return [head].concat(tail);
    }

importModuleItem
  = name:Name alias:alias {
      return node('importModuleItem', literalName(name), alias);
    }
  / name:Identifier {
      return node('importModuleItem', literalName(name), name);
    }

exportModuleItems
  = All { return []; }
  / head:exportModuleItem
    tail:( LIST_SEP item:exportModuleItem { return item; } )* {
      return [head].concat(tail);
    }

exportModuleItem
  = name:Identifier alias:alias {
      return node('exportModuleItem', reference(name), literalName(alias));
    }
  / name:Identifier {
      return node('exportModuleItem', reference(name), literalName(name));
    }

moduleSpecifiers
  = head:moduleSpecifier
    tail:( LIST_SEP spec:moduleSpecifier { return spec; } )* {
      return [head].concat(tail);
    }

moduleSpecifier
  = path:stringPath alias:alias {
      return node('moduleSpecifier', path, alias);
    }
  / path:modulePath alias:alias? {
      return node('moduleSpecifier', path, alias);
    }

exportStatement
  = op:Export __ exportable:exportable {
      return node(op, exportable);
    }

exportable
  = letStatement
  / importStatement
  / funcDeclaration
  / exportModuleItems
  / forStatement:forStatement {
      if ( !forStatement.reduceAssignments ) {
        error("'for' statements are not exportable");
      }
      return forStatement;
    }

forStatement
  = Reduce reduceAssignments:reduceAssignments __
    op:For ranges:ranges elsable:elsableStatements {
      return node(op, ranges, elsable[0], elsable[1], reduceAssignments);
    }
  / op:For ranges:ranges elsable:elsableStatements {
      return node(op, ranges, elsable[0], elsable[1]);
    }

reduceAssignments
  = __ head:reduceAssignment
    tail:( LIST_SEP a:reduceAssignment { return a; } )* {
      return [head].concat(tail);
    }

reduceAssignment
  = assignment
  / idAssignment

idAssignment
  = id:Identifier {
      return id.template('assignment', id, reference(id));
    }

ranges
  = __ head:range tail:( LIST_SEP r:range { return r; } )* {
      return [head].concat(tail);
    }

range
  = objectRange
  / arrayRange

objectRange
  = __ rangeIds:objectRangeIdentifier IN_SEP col:expr guard:guard? {
      return node('range', rangeIds.value, rangeIds.name, col, guard);
    }

objectRangeIdentifier
  = name:Identifier PROP_SEP value:Identifier {
      return { name: name, value: value };
    }

arrayRange
  = __ rangeIds:arrayRangeIdentifer IN_SEP col:expr guard:guard? {
      return node('range', rangeIds.value, rangeIds.name, col, guard);
    }

arrayRangeIdentifer
  = value:Identifier {
      return { value: value };
    }

trailingIfStatement
  = stmt:trailableStatement _ op:IfUnless __ condition:expr? {
      let statements = node('statements', [stmt]);
      let emptyStatements = node('statements', []);
      return node('if', condition, op ? statements : emptyStatements,
                                   op ? emptyStatements : statements);
    }

ifStatement
  = op:IfUnless __ condition:(letStatement / expr)
    elsable:elsableStatements {
      let tag = condition.tag === 'let' ? 'ifLet' : 'if';
      if ( !op ) {
        return node(tag, condition, elsable[1], elsable[0]);
      }
      return node(tag, condition, elsable[0], elsable[1]);
    }

elsableStatements
  = NL stmts:statements elseTail:blockElseTail {
      return [stmts, elseTail];
    }
  / __ ":" __ stmt:statement elseTail:elseTail? {
      return [statementsNode([stmt]), elseTail || node('statements', [])];
    }

blockElseTail
  = elseTail
  / End {
      return node('statements', []);
    }

elseTail
  = Else _ ifStatement:ifStatement {
      return node('statements', [ifStatement]);
    }
  / Else stmts:statementsTail {
      return stmts;
    }

letStatement
  = op:Let __ a:assignments {
      return node(op, a);
    }

assignments
  = head:assignment
    tail:( LIST_SEP a:assignment { return a; } )* {
      return [head].concat(tail);
    }

assignment
  = directAssignment
  / arrayDestructure
  / objectDestructure

directAssignment
  = id:Identifier __ "=" __ expr:expr {
      return node('assignment', id, expr);
    }

arrayDestructure
  = "[" __ ids:arrayDestructureIds __ "]" __ "=" __ expr:expr {
      return node('arrayDestructure', ids, expr);
    }

arrayDestructureIds
  = head:arrayDestructureId
    tail:( LIST_SEP id:arrayDestructureId { return id; } )* {
      return [head].concat(tail);
    }

arrayDestructureId
  = wildcard
  / Identifier

objectDestructure
  = "{" __ items:objectDestructureItems __ "}" __ "=" __ expr:expr {
      return node('objectDestructure', items, expr);
    }

objectDestructureItems
  = head:objectDestructureItem
    tail:( LIST_SEP item:objectDestructureItem { return item; } )* {
      return [head].concat(tail);
    }

objectDestructureItem
  = name:Name id:alias {
      return node('objectDestructureItem', id, literalName(name));
    }
  / name:expr id:alias {
      return node('objectDestructureItem', id, name);
    }
  / id:Identifier {
      return node('objectDestructureItem', id, literalName(id));
    }

idList
  = head:Identifier
    tail:( LIST_SEP id:Identifier { return id; } )* {
      return [head].concat(tail);
    }

returnStatement
  = op:Return _ expr:expr {
      return node(op, expr);
    }

emitStatement
  = op:Emit _ expr:expr {
      return node(op, expr);
    }

expr
  = rightCall

rightCall
  = args:compose
    calls:( __ op:rightCallOperator __ c:compose { return [op, c]; } )* {
      if ( !calls || !calls.length ) {
        return args;
      }

      calls.forEach(call => {
        let op = call[0];
        let target = call[1];

        if ( op === null ) {
          args = node('call', target, [args]);
          return;
        }

        args = target.template('call', target, [
          args.template('await', args, op)
        ]);
      });

      return args;
    }

rightCallOperator
  = RightCallAny   { return Syntax.Resolver.Any; }
  / RightCallAll   { return Syntax.Resolver.All; }
  / RightCallValue { return Syntax.Resolver.Value; }
  / RightCall      { return null; }

compose
  = head:composeOr
    tail:( __ Compose __ c:composeOr { return c; } )* {
      if ( !tail || !tail.length ) {
        return head;
      }
      return node('compose', [head].concat(tail));
    }

composeOr
  = head:composeAnd
    tail:( __ ComposeOr __ c:composeAnd { return c; } )* {
      if ( !tail || !tail.length ) {
        return head;
      }
      return node('composeOr', [head].concat(tail));
    }

composeAnd
  = head:conditional
    tail:( __ ComposeAnd __ c:conditional { return c; } )* {
      if ( !tail || !tail.length ) {
        return head;
      }
      return node('composeAnd', [head].concat(tail));
    }

conditional
  = tval:or _ op:IfUnless __ cond:or __ Else __ fval:conditional {
      if ( !op ) {
        return node('conditional', cond, fval, tval);
      }
      return node('conditional', cond, tval, fval);
    }
  / or

or
  = head:and
    tail:( __ op:Or __ r:and { return node(op, null, r); } )* {
      return buildBinaryChain(head, tail);
    }

and
  = head:equality
    tail:( __ op:And __ r:equality { return node(op, null, r); } )* {
      return buildBinaryChain(head, tail);
    }

equality
  = head:relational
    tail:( __ op:Equality __ r:relational { return node(op, null, r); } )* {
      return buildBinaryChain(head, tail);
    }

relational
  = head:additive
    tail:( __ op:Relational __ r:additive { return node(op, null, r); } )* {
      return buildBinaryChain(head, tail);
    }

additive
  = head:multiplicative
    tail:( _ op:Additive __ r:multiplicative { return node(op, null, r); } )* {
      return buildBinaryChain(head, tail);
    }

multiplicative
  = head:await
    tail:( __ op:Multiplicative __ r:await { return node(op, null, r); } )* {
      return buildBinaryChain(head, tail);
    }

await
  = op:Await mod:awaitModifier? __ expr:pattern {
      return node(op, expr, mod);
    }
  / pattern

awaitModifier
  = _ Any { return Syntax.Resolver.Any; }
  / _ All { return Syntax.Resolver.All; }

pattern
  = "~" __ expr:patternExpression {
      return expr.template('pattern', expr);
    }
  / match

patternExpression
  = nestedPattern
  / unary

nestedPattern
  = objectPattern
  / arrayPattern

objectPattern
  = "{" __ elems:objectPatternItems __ "}" {
      return node('objectPattern', elems || []);
    }
  / "{" __ "}" {
      return node('objectPattern', []);
    }

objectPatternItems
  = head:objectPatternItem
    tail:( LIST_SEP e:objectPatternItem { return e; })* {
      return [head].concat(tail)
    }

objectPatternItem
  = nestedPattern
  / objectPatternAssignment
  / expr

objectPatternAssignment
  = name:Name PROP_SEP value:patternValue {
      return node('patternElement', literalName(name), value);
    }
  / name:expr PROP_SEP value:patternValue {
      return node('patternElement', name, value);
    }

patternValue
  = wildcard
  / nestedPattern
  / expr

arrayPattern
  = "[" __ elems:arrayPatternElements? __ "]" {
      return node('arrayPattern', elems);
    }
  / "[" __ "]" {
      return node('arrayPattern', []);
    }

arrayPatternElements
  = head:patternValue
    tail:( LIST_SEP e:patternValue { return e; })* {
      return [head].concat(tail).map((element, idx) => {
        let indexNode = element.template('literal', idx);
        return node('patternElement', indexNode, element);
      });
    }

match
  = op:Match value:matchValue matches:matchClauses
    elseTail:matchElseTail {
      return node(op, value, matches, elseTail);
    }
  / unary

matchValue
  = __ expr:expr NL {
      return expr;
    }
  / NL {
      return null;
    }

matchElseTail
  = Else stmts:clauseTail End {
      return stmts;
    }
  / End {
      return node('statements', []);
    }

matchClauses
  = head:matchClause
    tail:(m:matchClause { return m; })* {
      return [head].concat(tail);
    }

matchClause
  = pattern:patternExpr stmts:clauseTail {
      return node('matchClause', pattern, stmts);
    }

clauseTail
  = NL stmts:statements {
      return stmts;
    }
  / __ ":" __ stmt:statement {
      return statementsNode([stmt]);
    }

unary
  = op:Unary _ expr:unary {
      return node(op, expr);
    }
  / op:Not __ expr:unary {
      return node(op, expr);
    }
  / listInterpolation

listInterpolation
  = str:string _ list:listNoParens {
      return node('call', str, [list]);
    }
  / member

member
  = head:list
    tail:(sel:memberSelector { return sel; })* {
      return buildBinaryChain(head, tail);
    }

memberSelector
  = __ "." _ elem:Name {
      return node('member', null, literalName(elem));
    }
  / _ "[" __ elem:expr __ "]" {
      return node('member', null, elem);
    }
  / _ args:callArgs {
      return node('call', null, args);
    }
  / _ args:bindArgs {
      return node('bind', null, args);
    }

callArgs
  = "(" __ elems:callElements __ ")" {
      return elems;
    }
  / "(" __ ")" {
      return [];
    }

callElements
  = head:callElement
    tail:( LIST_SEP e:callElement { return e; } )* {
      return [head].concat(tail);
    }

callElement
  = !wildcard e:expr { return e; }

bindArgs
  = "(" __ elems:bindElements __ ")" {
      return elems;
    }

bindElements
  = head:bindElement
    tail:( LIST_SEP e:bindElement { return e; } )* {
      return [head].concat(tail);
    }

bindElement
  = wildcard
  / expr

list
  = listNoParens
  / lambda

listNoParens
  = array
  / object

array
  = "[" __ expr:embeddedForExpression __ "]" {
      return node('arrayComp', expr);
    }
  / "[" __ elems:arrayElements __ "]" {
      return node('array', elems);
    }
  / "[" __ "]" {
      return node('array', []);
    }

arrayElements
  = head:expr
    tail:( LIST_SEP e:expr { return e; } )* {
      return [head].concat(tail);
    }

object
  = "{" __ expr:embeddedForExpression __ "}" {
      return node('objectComp', expr);
    }
  / "{" __ elems:objectAssignments __ "}" {
      return node('object', elems);
    }
  / "{" __ "}" {
      return node('object', []);
    }

objectAssignments
  = head:objectAssignment
    tail:( LIST_SEP a:objectAssignment { return a; } )* {
      return [head].concat(tail);
    }

objectAssignment
  = name:Name PROP_SEP value:expr {
      return node('objectAssignment', literalName(name), value);
    }
  / name:expr PROP_SEP value:expr {
      return node('objectAssignment', name, value);
    }
  / name:Name {
      return node('objectAssignment', literalName(name), name);
    }
  / name:expr {
      return node('objectAssignment', name, name);
    }

lambda
  = "(" __ params:idParamList? __  Arrow __ stmts:lambdaStatements __ ")" {
      return node('lambda',
        node('signature', null, params || []),
        node('statements', stmts)
      );
    }
  / params:lambdaParams? __ stmts:lambdaTail {
      return node('lambda',
        node('signature', null, params || []),
        node('statements', stmts)
      );
    }
  / doExpression

lambdaTail
  = Arrow NL stmts:lambdaStatements {
      return stmts;
    }
  / Arrow __ stmt:blockStatement {
      return [stmt];
    }

lambdaParams
  = "(" __ params:idParamList? __ ")" {
      return params;
    }
  / param:idParam {
      return [param];
    }

idParamList
  = head:idParam
    tail:( LIST_SEP id:idParam { return id; } )* {
      return [head].concat(tail);
    }

idParam
  = id:Identifier cardinality:paramCardinality? {
      return id.template('idParam', id, cardinality);
    }

lambdaStatements
  = head:blockStatement
    tail:( NL s:blockStatement { return s; } )* {
      return [head].concat(tail);
    }

doExpression
  = op:Do stmts:statementsTail {
      return node(op, stmts);
    }
  / Do __ When __ when:whenTail {
      return when;
    }
  / Do __ cases:caseClauses End {
      return node('case', cases);
    }
  / generateExpression

generateExpression
  = op:Generate stmts:statementsTail {
      return node(op, stmts);
    }
  / forExpression

whenTail
  = assignments:reduceAssignments stmts:statementsTail {
      return node('do', stmts, node('let', assignments));
    }
  / expr:expr stmts:statementsTail {
      return node('do', stmts, expr);
    }

caseClauses
  = head:caseClause
    tail:( w:caseClause { return w; } )* {
      return [head].concat(tail);
    }

caseClause
  = Case __ assignments:reduceAssignments stmts:clauseTail {
      return node('do', stmts, node('let', assignments));
    }
  / Case __ expr:expr stmts:clauseTail {
      return node('do', stmts, expr);
    }

forExpression
  = embeddedForExpression
  / reduceExpression

embeddedForExpression
  = For ranges:ranges select:forExpressionSelect {
      return node('forExpr', ranges, select);
    }
  / For range:range {
      return node('forExpr', [range]);
    }

forExpressionSelect
  = __ Select __ name:expr PROP_SEP value:expr {
      return node('select', value, name);
    }
  / __ Select __ value:expr {
      return node('select', value);
    }

reduceExpression
  = op:Reduce __ reduceAssignment:reduceExpressionAssignment __
    For ranges:ranges __ select:reduceExpressionSelect {
      return node(op, reduceAssignment, ranges, select);
    }
  / parens

reduceExpressionAssignment
  = directAssignment
  / idAssignment

reduceExpressionSelect
  = __ Select __ value:expr {
      return node('select', value);
    }

parens
  = "(" __ expr:expr __ ")" {
      return node('parens', expr);
    }
  / literal

literal
  = number
  / string
  / regex
  / boolean
  / context
  / self
  / global
  / reference

string
  = value:(MultiLineString / SimpleString) {
      if ( isFormatter(value.value) ) {
        return node('format', value);
      }
      return value;
    }

regex
  = re:Regex {
      return node('regex', re.pattern, re.flags);
    }

reference
  = "." _ elem:Name {
      return node('member', node('context'), literalName(elem));
    }
  / id:Identifier {
      return reference(id);
    }

boolean = True / False
identifier = Identifier
number = Number
context = Context
self = Self
global = Global
wildcard = Wildcard

/* Lexer *********************************************************************/

Await    = "await"    !NameContinue { return 'await'; }
Reduce   = "reduce"   !NameContinue { return 'reduce'; }
Do       = "do"       !NameContinue { return 'do'; }
Case     = "case"     !NameContinue { return 'case'; }
Match    = "match"    !NameContinue { return 'match'; }
For      = "for"      !NameContinue { return 'for'; }
Def      = "def"      !NameContinue { return 'function'; }
From     = "from"     !NameContinue { return 'from'; }
Import   = "import"   !NameContinue { return 'import'; }
Export   = "export"   !NameContinue { return 'export'; }
Let      = "let"      !NameContinue { return 'let'; }
And      = "and"      !NameContinue { return 'and'; }
Or       = "or"       !NameContinue { return 'or'; }
Like     = "like"     !NameContinue { return 'like'; }
Mod      = "mod"      !NameContinue { return 'mod'; }
Not      = "not"      !NameContinue { return 'not'; }
In       = "in"       !NameContinue { return 'in'; }
Return   = "return"   !NameContinue { return 'return'; }
Emit     = "emit"     !NameContinue { return 'emit'; }
Generate = "generate" !NameContinue { return 'generate'; }
Context  = "it"       !NameContinue { return node('context'); }
Self     = "self"     !NameContinue { return node('self'); }
Global   = "global"   !NameContinue { return node('global'); }
True     = "true"     !NameContinue { return node('literal', true); }
False    = "false"    !NameContinue { return node('literal', false); }
If       = "if"       !NameContinue { return true; }
Unless   = "unless"   !NameContinue { return false; }
Any      = "any"      !NameContinue { return 'any'; }
All      = "all"      !NameContinue { return 'all'; }
As       = "as"       !NameContinue
By       = "by"       !NameContinue
Else     = "else"     !NameContinue
End      = "end"      !NameContinue
Where    = "where"    !NameContinue
Select   = "select"   !NameContinue
When     = "when"     !NameContinue

Arrow      = "->" / "→"

Compose    = "o" !NameContinue / "∘"
ComposeOr  = "|" __ "|"
ComposeAnd = "&" __ "&"

RightCallAny   = "?" __ "|"
RightCallAll   = ":" __ "|"
RightCallValue = "." __ "|"
RightCall      = "|"

NotLike = Not __ Like { return 'notLike'; }
NotIn   = Not __ In   { return 'notIn'; }

ReservedWord "reserved word"
  = ( For / Def / Do / From / Import / Export / Let / And / Or / Like / Mod /
      Not / If / Unless / True / False / As / In / Return / Else / End /
      Where / Select / Reduce / Await / Any / All / When / Case / Match /
      Context / Self / Global / Wildcard / Compose / Emit / Generate )

Identifier "identifier"
  = !ReservedWord name:Name {
      return name;
    }

Name "name"
  = start:NameStart cont:NameContinue* {
      return node('id', start + cont.join(''));
    }

NameStart
  = [$_a-zA-Z]

NameContinue
  = NameStart
  / [$_a-zA-Z0-9]

Digit
  = [0-9]

Card
  = h:[1-9] t:Digit+ {
      return h + t.join('');
    }
  / Digit

Exp
  = [eE] s:[-+]? d:Digit+ {
      return 'e' + (s ? s : '+') + d.join('');
    }

Frac
  = "." d:Digit+ {
      return '.' + d.join('');
    }

Number "number"
  = c:Card f:Frac? e:Exp? {
      return node('literal', parseFloat(c + (f ? f : '') + (e ? e : '')));
    }

Char
  = .

MultiLineString "multi-line string"
  = MLString1
  / MLString2

MLString1
  = '"""' MLTrim? chars:( !MLTail1 c:Char { return c; } )* MLTail1 {
      return node('literal', chars.join(''));
    }

MLString2
  = "'''" MLTrim? chars:( !MLTail2 c:Char { return c; } )* MLTail2 {
      return node('literal', chars.join(''));
    }

MLTrim
  = WS* NL

MLTail1
  = NL? '"""'

MLTail2
  = NL? "'''"

SimpleString "string"
  = '"' '"'               { return node('literal', ''); }
  / "'" "'"               { return node('literal', ''); }
  / '"' c:DoubleChar+ '"' { return node('literal', c.join('')); }
  / "'" c:SingleChar+ "'" { return node('literal', c.join('')); }

DoubleChar
  = [^"\\]
  / CommonChar

SingleChar
  = [^'\\]
  / CommonChar

CommonChar
  = "\\\\" { return "\\"; }
  / '\\"'  { return '"'; }
  / "\\'"  { return "'"; }
  / "\\b"  { return "\b"; }
  / "\\f"  { return "\f"; }
  / "\\n"  { return "\n"; }
  / "\\r"  { return "\r"; }
  / "\\t"  { return "\t"; }

IfUnless
  = If
  / Unless

EQ  = "=" { return 'eq'; }
LT  = "<" { return 'lt'; }
GT  = ">" { return 'gt'; }

NEQ = ("!=" / "≠") { return 'neq'; }
LTE = ("<=" / "≤") { return 'lte'; }
GTE = (">=" / "≥") { return 'gte'; }

Add = "+" { return 'add'; }
Sub = "-" { return 'sub'; }

Mul = ( "*" / "•" ) { return 'mul'; }
Div = ( "/" / "÷" ) { return 'div'; }

Neg = "-" { return 'neg'; }
Pos = "+" { return 'pos'; }

Equality = Like / NEQ / EQ / NotLike
Relational = GTE / LTE / LT / GT / In / NotIn
Additive = Add / Sub
Multiplicative = Mul / Div / Mod
Unary = Neg / Pos

Regex "regular expression"
  = "/" pattern:$RegexBody "/" flags:$RegexFlags {
      return { pattern, flags };
    }

RegexBody
  = RegexFirstChar RegexChar*

RegexFirstChar
  = ![*\\/[] RegexNonTerminator
  / RegexBackslashSequence
  / RegexClass

RegexChar
  = ![\\/[] RegexNonTerminator
  / RegexBackslashSequence
  / RegexClass

RegexBackslashSequence
  = "\\" RegexNonTerminator

RegexNonTerminator
  = !LF Char

RegexClass
  = "[" RegexClassChar* "]"

RegexClassChar
  = ![\]\\] RegexNonTerminator
  / RegexBackslashSequence

RegexFlags
  = [gim]*

WS "whitespace"
  = [ \t\v\f]

LF "line feed"
  = [\n\r]

LFOrEOF
  = LF / !.

EOL "end of line"
  = WS* Comment
  / WS* LFOrEOF

Comment "comment"
  = "#" (!LFOrEOF Char)*

Wildcard "wildcard"
  = "_" { return node('wildcard'); }

NL "line terminator"
  = ( WS / Comment )* LFOrEOF ( WS / Comment / LF )*

__ "whitespace with newline"
  = ( WS / Comment / LF )*

_  "whitespace"
  = WS*

AS_SEP = __ As __
IN_SEP = __ In __
LIST_SEP = __ "," __
PROP_SEP = __ ":" __
