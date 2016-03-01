{
  let isFormatter = require('../runtime/Format').isFormatter;
  let Syntax = require('./Syntax');

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

    tail.forEach(function (item) {
      item.left = head;
      head = item;
    });

    return head;
  }

  function statementsNode(arr) {
    if ( !arr ) {
      return node('statements', []);
    }
    return node('statements', arr.filter(function (value) {
      return value !== null;
    }));
  }
}

start = module

/** Parser *******************************************************************/

module
  = __ statements:moduleStatement*  {
      return statementsNode(statements);
    }

moduleStatement
  = s:exportStatement NL  { return s; }
  / statement

statements
  = statements:statement*  {
      return statementsNode(statements);
    }

statement
  = s:blockStatement NL  {
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
  / exprStatement

exprStatement
  = expr:expr  {
      return node('expression', expr);
    }

declStatement
  = funcDeclaration

funcDeclaration
  = op:Def signature:signature statements:statementsTail  {
      return node(op, signature, statements);
    }

signature
  = __ id:Identifier _ params:params? guard:guard?  {
      return node('signature', id, params, guard);
    }

guard
  = __ Where __ expr:expr  {
      return expr;
    }

statementsTail
  = NL statements:statements End  {
      return statements;
    }

params
  = "(" __ params:paramList __ ")"  {
      return params;
    }
  / "(" __ ")"  {
      return [];
    }

paramList
  = start:paramDef
    cont:( LIST_SEP param:paramDef  { return param; } )*  {
      return [start].concat(cont);
    }

paramDef
  = pattern:patternExpr alias:( AS_SEP id:Identifier { return id; } )  {
      return node('patternParam', alias, pattern);
    }
  / id:Identifier  {
      return node('idParam', id);
    }
  / pattern:patternExpr  {
      return node('patternParam', null, pattern);
    }

patternExpr
  = expr:expr  {
      return expr.template('pattern', expr);
    }

importStatement
  = op:From path:(modulePath / stringPath)
    __ Import __ imports:moduleItems  {
      return node(op, path, imports);
    }
  / op:Import __ modules:moduleSpecifiers  {
      return node(op, modules);
    }

stringPath
  = __ path:SimpleString  {
      return node('modulePath', path.value);
    }

modulePath
  = __ start:moduleComp cont:( "." item:moduleComp { return item; } )*  {
      return node('modulePath', [start].concat(cont).join('/'));
    }

moduleComp
  = !ReservedWord name:Name  {
      return name.value;
    }

moduleItems
  = start:moduleItem cont:( LIST_SEP item:moduleItem { return item; } )*  {
      return [start].concat(cont);
    }

moduleItem
  = name:Name AS_SEP alias:Identifier  {
      return node('moduleItem', name, alias);
    }
  / name:Identifier  {
      return node('moduleItem', name, null);
    }

moduleSpecifiers
  = start:moduleSpecifier
    cont:( LIST_SEP spec:moduleSpecifier { return spec; } )*  {
      return [start].concat(cont);
    }

moduleSpecifier
  = path:stringPath AS_SEP alias:Identifier  {
      return node('moduleSpecifier', path, alias);
    }
  / path:modulePath alias:( AS_SEP id:Identifier  { return id; } )?  {
      return node('moduleSpecifier', path, alias);
    }

exportStatement
  = op:Export __ exportable:exportable  {
      return node(op, exportable);
    }

exportable
  = letStatement
  / importStatement
  / funcDeclaration
  / moduleItems

forStatement
  = Reduce reduceAssignments:reduceAssignments __
    op:For ranges:ranges NL statements:statements tail:elseTail  {
      return node(op, ranges, statements, tail, reduceAssignments);
    }
  / op:For ranges:ranges NL statements:statements tail:elseTail  {
      return node(op, ranges, statements, tail);
    }

reduceAssignments
  = __ start:reduceAssignment
    cont:( LIST_SEP a:reduceAssignment { return a; } )*  {
      return [start].concat(cont);
    }

reduceAssignment
  = assignment
  / idAssignment

idAssignment
  = id:Identifier  {
      return id.template('assignment', id, id);
    }

ranges
  = __ start:range cont:( LIST_SEP r:range { return r; } )*  {
      return [start].concat(cont);
    }

range
  = objectRange
  / arrayRange

objectRange
  = __ rangeIds:objectRangeIdentifier IN_SEP col:expr guard:guard?  {
      return node('range', rangeIds.value, rangeIds.name, col, guard);
    }

objectRangeIdentifier
  = name:Identifier PROP_SEP value:Identifier  {
      return { name: name, value: value };
    }

arrayRange
  = __ rangeIds:arrayRangeIdentifer IN_SEP col:expr guard:guard?  {
      return node('range', rangeIds.value, rangeIds.name, col, guard);
    }

arrayRangeIdentifer
  = value:Identifier  {
      return { value: value };
    }

trailingIfStatement
  = stmt:trailableStatement _ op:IfUnless __ condition:expr?  {
      let statements = node('statements', [stmt]);
      let emptyStatements = node('statements', []);
      return node('if', condition, op ? statements : emptyStatements,
                                   op ? emptyStatements : statements);
    }

ifStatement
  = op:IfUnless __ condition:(letStatement / expr) NL
    statements:statements tail:elseTail  {
      var tag = condition.tag === 'let' ? 'ifLet' : 'if';
      if ( !op ) {
        return node(tag, condition, tail, statements);
      }
      return node(tag, condition, statements, tail);
    }

elseTail
  = Else _ ifStatement:ifStatement  {
      return node('statements', [ifStatement]);
    }
  / Else NL statements:statements End  {
      return statements;
    }
  / End  {
      return node('statements', []);
    }

letStatement
  = op:Let __ a:assignments  {
      return node(op, a);
    }

assignments
  = start:assignment
    cont:( LIST_SEP a:assignment { return a; } )*  {
      return [start].concat(cont);
    }

assignment
  = id:Identifier __ "=" __ expr:expr  {
      return node('assignment', id, expr);
    }

returnStatement
  = op:Return _ expr:expr  {
      return node(op, expr);
    }

expr
  = rightCall

rightCall
  = args:conditional calls:( __ "|" __ c:conditional { return c; } )*  {
      if ( calls && calls.length ) {
        for ( let i = 0, len = calls.length; i < len; i++ ) {
          args = node('call', calls[i], [args]);
        }
      }
      return args;
    }

conditional
  = tval:or _ op:IfUnless __ cond:or __ Else __ fval:conditional  {
      if ( !op ) {
        return node('conditional', cond, fval, tval);
      }
      return node('conditional', cond, tval, fval);
    }
  / or

or
  = head:and
    tail:( _ op:Or __ r:and  { return node(op, null, r); } )*  {
      return buildBinaryChain(head, tail);
    }

and
  = head:equality
    tail:( _ op:And __ r:equality { return node(op, null, r); } )*  {
      return buildBinaryChain(head, tail);
    }

equality
  = head:relational
    tail:( _ op:Equality __ r:relational { return node(op, null, r); } )*  {
      return buildBinaryChain(head, tail);
    }

relational
  = head:additive
    tail:( _ op:Relational __ r:additive { return node(op, null, r); } )*  {
      return buildBinaryChain(head, tail);
    }

additive
  = head:multiplicative
    tail:( _ op:Additive __ r:multiplicative { return node(op, null, r); } )*  {
      return buildBinaryChain(head, tail);
    }

multiplicative
  = head:pattern
    tail:( _ op:Multiplicative __ r:pattern { return node(op, null, r); } )*  {
      return buildBinaryChain(head, tail);
    }

pattern
  = "~" _ expr:unary  {
      return expr.template('pattern', expr);
    }
  / unary

unary
  = op:Unary _ expr:unary  {
      return node(op, expr);
    }
  / listInterpolation

listInterpolation
  = str:string _ list:listNoParens  {
      return node('call', str, [list]);
    }
  / member

member
  = head:list
    tail:(sel:memberSelector { return sel; })*  {
      return buildBinaryChain(head, tail);
    }

memberSelector
  = __ "." _ elem:Name  {
      return node('member', null, elem.template('literal', elem.value));
    }
  / _ "[" __ elem:expr __ "]"  {
      return node('member', null, elem);
    }
  / _ args:callArgs  {
      return node('call', null, args);
    }
  / _ args:bindArgs  {
      return node('bind', null, args);
    }

callArgs
  = "(" __ elems:callElements __ ")"  {
      return elems;
    }
  / "(" __ ")"  {
      return [];
    }

callElements
  = start:callElement
    cont:( LIST_SEP e:callElement  { return e; } )*  {
      return [start].concat(cont);
    }

callElement
  = !wildcard e:expr  { return e; }

bindArgs
  = "(" __ elems:bindElements __ ")"  {
      return elems;
    }

bindElements
  = start:expr
    cont:( LIST_SEP e:expr  { return e; } )*  {
      return [start].concat(cont);
    }

list
  = listNoParens
  / lambda

listNoParens
  = array
  / object

array
  = "[" __ comp:arrayComprehension __ "]"  {
      return comp;
    }
  / "[" __ elems:arrayElements __ "]"  {
      return node('array', elems);
    }
  / "[" __ "]"  {
      return node('array', []);
    }

arrayElements
  = start:expr
    cont:( LIST_SEP e:expr  { return e; } )*  {
      return [start].concat(cont);
    }

arrayComprehension
  = For ranges:ranges expr:expressionSelect  {
      return node('arrayComp', ranges, expr);
    }
  / For range:arrayRange  {
      return node('arrayComp', [range]);
    }

expressionSelect
  = __ Select __ expr:expr  {
      return expr;
    }

object
  = "{" __ comp:objectComprehension __ "}"  {
      return comp;
    }
  / "{" __ elems:objectAssignments __ "}" {
      return node('object', elems);
    }
  / "{" __ "}"  {
      return node('object', []);
    }

objectAssignments
  = start:objectAssignment
    cont:( LIST_SEP a:objectAssignment { return a; } )*  {
      return [start].concat(cont);
    }

objectAssignment
  = name:Name PROP_SEP value:expr  {
      return node('objectAssignment',
                  name.template('literal', name.value), value);
    }
  / name:expr PROP_SEP value:expr  {
      return node('objectAssignment', name, value);
    }
  / name:Name  {
      var nameValue = name.template('literal', name.value)
      if ( name.value === 'self' ) {
        return node('objectAssignment', nameValue, name.template('self'));
      }
      return node('objectAssignment', nameValue, name);

    }
  / name:expr  {
      return node('objectAssignment', name, name);
    }

objectComprehension
  = For ranges:ranges assign:objectAssignmentSelect  {
      return node('objectComp', ranges, assign);
    }
  / For range:objectRange  {
      return node('objectComp', [range]);
    }

objectAssignmentSelect
  = __ Select __ assign:objectAssignment  {
      return assign;
    }

lambda
  = params:lambdaParams? __ "->" __
    stmts:lambdaStatements  {
      return node('lambda',
        node('signature', null, params || []),
        node('statements', stmts)
      );
    }
  / doExpression

lambdaParams
  = "(" __ params:idParamList? __ ")"  { return params; }
  / idParamList

lambdaStatements
  = head:blockStatement
    tail:(NL s:blockStatement { return s; })* {
      return [head].concat(tail);
    }

idParamList
  = start:idParam
    cont:( LIST_SEP id:idParam { return id; })*  {
      return [start].concat(cont);
    }

idParam
  = id:Identifier  { return id.template('idParam', id); }

doExpression
  = op:Do NL stmts:statements End {
      return node(op, stmts);
    }
  / reduceExpression

reduceExpression
  = op:Reduce __ reduceAssignment:reduceAssignment __
    For ranges:ranges __ select:expressionSelect  {
      return node(op, reduceAssignment, ranges, select);
    }
  / parens

parens
  = "(" __ expr:expr __ ")"  {
      return expr;
    }
  / literal

literal
  = number
  / string
  / regex
  / boolean
  / self
  / identifier
  / wildcard

string
  = value:(MultiLineString / SimpleString)  {
      if ( isFormatter(value.value) ) {
        return node('format', value);
      }
      return value;
    }

regex
  = re:Regex  {
      return node('regex', re.pattern, re.flags);
    }

boolean = True / False
identifier = Identifier
number = Number
self = Self
wildcard = Wildcard

/* Lexer *********************************************************************/

Await   = "await"    !NameContinue  { return 'await'; }
Reduce  = "reduce"   !NameContinue  { return 'reduce'; }
Do      = "do"       !NameContinue  { return 'do'; }
For     = "for"      !NameContinue  { return 'for'; }
Def     = "def"      !NameContinue  { return 'function'; }
From    = "from"     !NameContinue  { return 'from'; }
Import  = "import"   !NameContinue  { return 'import'; }
Export  = "export"   !NameContinue  { return 'export'; }
Let     = "let"      !NameContinue  { return 'let'; }
And     = "and"      !NameContinue  { return 'and'; }
Or      = "or"       !NameContinue  { return 'or'; }
Like    = "like"     !NameContinue  { return 'like'; }
Mod     = "mod"      !NameContinue  { return 'mod'; }
Not     = "not"      !NameContinue  { return 'not'; }
In      = "in"       !NameContinue  { return 'in'; }
NotIn   = Not _ In   !NameContinue  { return 'notIn'; }
Return  = "return"   !NameContinue  { return 'return'; }
Self    = "self"     !NameContinue  { return node('self'); }
True    = "true"     !NameContinue  { return node('literal', true); }
False   = "false"    !NameContinue  { return node('literal', false); }
If      = "if"       !NameContinue  { return true; }
Unless  = "unless"   !NameContinue  { return false; }
As      = "as"       !NameContinue
By      = "by"       !NameContinue
Else    = "else"     !NameContinue
End     = "end"      !NameContinue
Where   = "where"    !NameContinue
Select  = "select"   !NameContinue

ReservedWord "reserved word"
  = ( For / Def / Do / From / Import / Export / Let / And / Or /
      Like / Mod / Not / If / Unless / True / False / As / In /
      Return / Self / Else / End / Where / Select / Reduce / Await )

Identifier "identifier"
  = !ReservedWord name:Name  {
      return name;
    }

Name "name"
  = start:NameStart cont:NameContinue*  {
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
  = h:[1-9] t:Digit+  {
      return h + t.join('');
    }
  / Digit

Exp
  = [eE] s:[-+]? d:Digit+  {
      return 'e' + (s ? s : '+') + d.join('');
    }

Frac
  = "." d:Digit+  {
      return '.' + d.join('');
    }

Number "number"
  = c:Card f:Frac? e:Exp?  {
      return node('literal', parseFloat(c + (f ? f : '') + (e ? e : '')));
    }

Char
  = .

MultiLineString "multi-line string"
  = MLString1
  / MLString2

MLString1
  = '"""' MLTrim? chars:( !MLTail1 c:Char { return c; } )* MLTail1  {
      return node('literal', chars.join(''));
    }

MLString2
  = "'''" MLTrim? chars:( !MLTail2 c:Char { return c; } )* MLTail2  {
      return node('literal', chars.join(''));
    }

MLTrim
  = WS* NL

MLTail1
  = NL? '"""'

MLTail2
  = NL? "'''"

SimpleString "string"
  = '"' '"'                { return node('literal', ''); }
  / "'" "'"                { return node('literal', ''); }
  / '"' c:DoubleChar+ '"'  { return node('literal', c.join('')); }
  / "'" c:SingleChar+ "'"  { return node('literal', c.join('')); }

DoubleChar
  = [^"\\]
  / CommonChar

SingleChar
  = [^'\\]
  / CommonChar

CommonChar
  = "\\\\"  { return "\\"; }
  / '\\"'   { return '"'; }
  / "\\'"   { return "'"; }
  / "\\b"   { return "\b"; }
  / "\\f"   { return "\f"; }
  / "\\n"   { return "\n"; }
  / "\\r"   { return "\r"; }
  / "\\t"   { return "\t"; }

IfUnless
  = If
  / Unless

EQ  = "="   { return 'eq'; }
NEQ = "!="  { return 'neq'; }
LT  = "<"   { return 'lt'; }
GT  = ">"   { return 'gt'; }
LTE = "<="  { return 'lte'; }
GTE = ">="  { return 'gte'; }

Add = "+"   { return 'add'; }
Sub = "-"   { return 'sub'; }

Mul = "*"   { return 'mul'; }
Div = "/"   { return 'div'; }

Neg = "-"   { return 'neg'; }
Pos = "+"   { return 'pos'; }

Equality = Like / NEQ / EQ
Relational = GTE / LTE / LT / GT / In / NotIn
Additive = Add / Sub
Multiplicative = Mul / Div / Mod
Unary = Await / Neg / Pos / Not

Regex "regular expression"
  = "/" pattern:$RegexBody "/" flags:$RegexFlags  {
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
  = "?"  {
      return node('wildcard');
    }

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
