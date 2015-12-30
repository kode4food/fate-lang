---
title: Data | A Guide to Fate
layout: fate_guide
prev: intro
next: interpolation
---
## Data in Fate
Fate was specifically designed to consume JSON messages via Functions and Patterns.  As such, it excels in this area, but falls flat on its face in others.  No single language is a panacea, and so Fate doesn't attempt to be.

### Reserved Words
Fate reserves the following identifiers as keywords:

    for, def, when, from, import, export, let, and, or, like, mod,
    not, if, unless, true, false, as, in, return, self, else, end,
    where, select

Attempting to assign or retrieve these keywords as local variables will result in parsing errors.

### Literals
Literals are values expressed in terms of themselves, rather than by variable references.  So for example, if I talked about a variable `name` I would really be talking about whatever it is that name refers to.  In the case of Literals, they *are* the values.  Some might refer to literals as fixed, or atomic.  Examples of Literals might include: `3.14`, `'Hello, World'`, and `false`.

#### Numbers
Numeric Literals in Fate can only be represented as either real or integers, and only in decimal notation.  The following are acceptable numeric literals:

```ruby
0
103
99.995
19.123e12
5.32e-5
```

#### Strings
Strings are a series of characters (letters and so on).  Fate provides two ways to represent strings: simple and multi-line.

A simple string starts and ends with either a single or double quote, and does not break across multiple lines:

```ruby
'This is a simple string'
```

A multi-line string starts and ends with triple-quotes (''' or """) and may include line breaks:

```ruby
'''
This
string
spans
multiple
lines
'''
```

##### Escaping
Strings allow special characters to be included using an escaping method (a leading backslash `\`).  These characters are ones that would be difficult to represent as part of the string, such as a single quote or an embedded newline.

| Escape | Description        |
|:------:| ------------------ |
| \\\    | A single backslash |
| \"     | A double quote     |
| \'     | A single quote     |
| \b     | Bell               |
| \f     | Form-Feed          |
| \n     | Unix Newline       |
| \r     | Carriage Return    |
| \t     | Tab                |

#### Booleans
The value of a Boolean literal is either true or false, so that's how you write them: `true` or `false`.

### Identifiers
An Identifier is a name that can be used to retrieve a variable or member.  Fate Identifiers must start with one of the following characters: (a-zA-Z_$).  All characters thereafter may also include digits: (0-9).  Identifiers can not be any of the Fate reserved words.

### Operators
#### Additive (+, -)
The additive operators are `+` and `-`.

#### Multiplicative (*, /)
The multiplicative operators are `*`, `/`, and `mod` (modulo)

#### Unary (-, not)
Only two traditional unary operators are supported.  They are `-` for numeric negation, and `not` for boolean *not* negation.

```ruby
-transactionAmount
not happy
```

#### Precedence Override
You can override the precedence by which expressions are evaluated by enclosing those expressions in parentheses `()`:

```ruby
(28 - 7) * 2
```

### Arrays
Arrays are a sequence of elements surrounded by square braces `[]` and separated by commas `,`.  The elements of an array can only be accessed by numerical index.  These indexes are zero-based, meaning the first element is accessed with 0, and so on.

```ruby
let a = [1 + 8]      # single item array containing the number 9
let b = [5, 9 + 12]  # two item array containing 5 and 21

a[0]                 # displays 9
b[1]                 # displays 21
```

### Objects
Objects are a set of name/value pairs surrounded by curly braces `{}` and separated by commas `,`.  Both the names and values can be constructed using any valid expression.  If the name is an Identifier, it will be treated as a literal string.

```ruby
{
  theMachine: 'Deep Thought',
  theAnswer: (28 - 7) * 2
}
```

### Member Retrieval
Like in JavaScript, membership expressions allow you to drill into an Array or Object's properties or elements.

```ruby
myArray[0]
myArray[someIndex or 0]
myObject.someProperty
myObject['someProperty']
```

### Assignment
Fate does not have a general-purpose assignment operator (like JavaScript's `=` operator).  Instead, it allows you to bind variables to the current scope only using the `let` statement.

```ruby
let a = 42, b = {name: 'Thom', age: a}, c = b | 'Howdy, %name'
```

You can also spread this across multiple lines, but the commas *must* be on the preceding line:

```ruby
let a = 42,
    b = {name: 'Thom', age: a},
    c = b | 'Howdy, %name'
```

#### Static Single Assignment 
Probably the single most important concept to understand about Fate is that it compiles down to something called Static Single Assignment Form.  What this means is that if you re-assign a variable that's in scope, the language will not simply overwrite the data the variable points to.  Instead, it will create an entirely new version of the variable, and leave the previous one intact.

Normally, you wouldn't even notice this behavior, but it becomes particularly important when you create nested functions and joins. In JavaScript, re-assigning a variable from within a closure means that you overwrite the variable for everyone referring to it.  In Fate, this is not the case.  For Example:

```javascript
function outer() {
  let x = 100;
  function inner() {
    x = x + 100;
  }
  inner();
  return x;  // will return 200
}
```  

```ruby
def outer
  let x = 100
  def inner
    let x = x + 100
  end
  inner()
  x  # will return 100
end
```

The reason for this is because Fate treats your code as if it's something like this:

```ruby
def outer
  let x1 = 100
  def inner
    let x2 = x1 + 100
  end
  inner()
  x1  # will return 100
end
```
