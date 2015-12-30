---
title: Branching | A Guide to Fate
layout: fate_guide
prev: patterns
next: looping
---
## Logical Branching

### if / unless /else
Like in most programming languages, Fate supports conditional branching in the form of If/Else statements.  The expression provided to `if` is evaluated using Fate's *truthy* rules.  In its simplest form, it wouldn't include an `else` block and might look like this:

```ruby
if person.name = 'Curly'
  "Curly was awesome!"
end
```

If the condition is not met, you can also branch to an `else` block:

```ruby
if person.name = 'Curly'
  "Curly was awesome!"
else
  "This stooge was not so great"
end
```

`else` immediately followed by `if` is treated specially in that it doesn't require a nested `end` keyword.

```ruby
if person.name = 'Curly'
  "Curly was awesome!"
else if person.name = 'Shemp'
  "Ok, Shemp was alright"
else
  "This stooge was not so great"
end
```

*Note:* The `unless` keyword is syntactic sugar that can be used in place of `if not`.  Its purpose is to implicitly negate the condition.  So `if not happy` becomes `unless happy`.

### if let
The `if let` statement is similar to a normal if / unless / else, except that it allows the developer to assign a set of variables.  Then, if all of the variables are succesfully assigned (meaning that they match the `Something` Pattern) the branch will be executed.

```ruby
if let name=getName(person), profile=getProfile(person)
  # name and profile have values, do something with them
else
  # either name or profile matched the Nothing Pattern
end
```

### Conditionals
The conditional or ternary operator works just as you would expect from Python.  It will evaluate the first operand if the condition is met (or not met in the case of `unless`), otherwise it will return the evaluation of the third operand.

```ruby
# <true_value> if <condition> else <false_value>
"you are happy!" if happy else "awwwwwww"

# <false_value> unless <condition> else <true_value>
"awwwwwww" unless happy else "you are happy!"
```

### Truthy and Falsy
Fate conditionals always test whether an expression is 'truthy' or 'falsy'.  So you don't generally have to compare expressions directly to `true` or `false`.  In fact, you should only do so if you're expecting the actual value, as Fate's equality operators are rather strict.

In Fate, a value must match the following conditions to be considered 'truthy':

  * Not the boolean value 'false'
  * Not the number 0 (zero)
  * Not matching the 'Nothing' Pattern

Falsy is any value that is not 'truthy'.

### Boolean Operators (or, and)
This concept of 'truthy' also applies to the Boolean Operators.

#### Or
In boolean logic, the `or` operator basically states that one or the other operand must be true.  In Fate, it's implemented by testing the left operand for 'truthiness'.  If it matches, then it will be returned.  Otherwise the right operand will be evaluated and returned.

#### And
In boolean logic, the `and` operator basically states that both operands must be true.  In Fate, it's implemented by testing the left operand for 'truthiness'.  If it matches, then the right operand will be evaluated and returned.  Otherwise the left operand will be returned.

### Equality Operators (=, !=, like)
The `=` and `!=` operators perform strict equality checking, identical to JavaScript's `===` and `!==` operators.

```ruby
1 = '1'  # results in false
1 != '1'  # results in true
```

#### Like
The `like` operator is a little different.  Like will perform a pattern comparison of values to determine whether the left operand matches the Pattern on the right.  If the right operand is not a Pattern, the match will be performed dynamically, which is more expensive.

Matching is mostly as you would expect, with one exception.  If the Pattern contains an Array or Object, only the elements defined are checked.  If the left operand has additional elements, those are ignored.

```ruby
let myObject = {
  name: 'Fred',
  occupation: 'developer',
  age: 42,
  company: 'ACME Software'
}

if myObject like {occupation:'developer', age:42}
  'YEP!'
end
```

### Relational Operators (<, <=, >=, >)
The relational operators are `<` (less than), `<=` (less than or equal), `>` (greater than), and `>=` (greater than or equal).
