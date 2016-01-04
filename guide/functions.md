---
title: Functions | A Guide to Fate
layout: fate_guide
prev: looping
next: join
---
## All About Functions
Functions are self-contained sets of statements meant to accomplish a particular task.  They accept zero or more parameters and optionally return a result.  They can then be called by other Functions or invoked as part of Expressions.  For example, one might write a function to return a value from the Fibonnaci sequence:

```ruby
def fib(n)
  n if n < 2 else fib(n-1) + fib(n-2) 
end
```

Functions are first-class elements of Fate, meaning they can be passed around and assigned to variables.

### Guarded Function
The definition of a function can also be 're-opened' to apply guard clauses, or to shadow the function if no guard clause is provided.  The order in which functions are defined determines the order in which the guard clauses are evaluated, where the most recently defined will be evaluated first.  For example:

```ruby
def fib(n)
  n
end

def fib(n) where n >= 2
  fib(n-1) + fib(n-2) 
end
```

In this case, if `n` was greater or equal to 2, the second variation of fib would be executed.  Otherwise control would fall-through to the first.  If the unguarded version of fib had been defined last, it would shadow the previous definition, thus short-circuiting its possible evaluation.

    Re-opening a function applies only to the current scope (and any of its nested scopes).  If you import a function from a module and then re-open it with a guard, the re-opened version *will not* be applied globally.

### Inline-Guards
Fate supports pattern matching capability in Function Definitions.  This facilitates what are essentially inline-guards.  For example:

```ruby
def printItem(type, name)
  { type, name } | "This is a %type named %name" | print
end
```

This function can be extended to deal with specific type values:

```ruby
def printItem('developer', name)
  { name } | "Developers rock! Especially %name" | print
end
```

In this case, no local argument name is bound to the value.  You can simply treat it as discarded.  On the other hand, sometimes you're performing matching against complex values and you may need access to the entire value in the body of your function.  To do this, you can alias it like so:

```ruby
def renderPerson({type:'developer'} as person)
  person | '%name writes code'
end

def renderPerson({type:'banker'} as person)
  person | '%name steals money'
end

let me = {name:'Thom', type:'developer', age:42}
renderPerson(me)
```

### Lambdas
A Lambda is a special type of function.  Specifically, it's one that can be included as part of an Expression.  Unlike normal Function declarations, a lambda only accepts named arguments and cannot include a guard.  A lambda is declared as follows:

```
lambda      : lambda_args? "->" statement+

lambda_args : "(" arg_names? ")"
            | arg_names

arg_names   : id ( "," id )*
```

Argument names are optional, meaning that a lambda can be kicked off just by using the arrow operator `->`.  Also, the parser will consume as many statements as it can, across multiple lines.  Meaning it's your responsibility to contain a lambda using parentheses, when appropriate.  For example:

```ruby
# the parens keep the parser from grabbing the second assignment
let my_lambda = (x, y -> x + y)
let x = my_lambda(12, 10)
```

On the other hand, where one might normally include a lambda expression, this is not usually a problem.  For example:

```ruby
# the function call's parens will contain the lambda statement(s)
timeout(100, ->
  # go until we hit the closing paren
  do_stuff()
  do_more_stuff()
)
```

### Function and Lambda Calls
Calling a Function or Lambda in Fate is like calling a function in JavaScript or similar languages.  This means that if you provide too few arguments to a Function, they will be assumed to match the `Nothing` Pattern.

```ruby
from pattern import Nothing

def func(arg1, arg2, arg3)
  print("arg3 not provided") if arg3 like Nothing
end

func(1, 2)  # third argument not provided
```

### Call Binding (?)
Fate supports Function argument binding via wildcards (`?`).  For Example:

```ruby
from array import join
let j = join(?, ' -- ')
let a = ['joined','with','dashes']
"Result is %a|j"
```

Binding is also useful against functions when you want to pass them around for later invocation:

```ruby
from layouts import mainLayout
from functions import printList
let printItems = printList(items, ?)
mainLayout('A Title', printItems)
```

Now, when mainLayout invokes `printItems()`, the bound list in `items` will be rendered.

### Piped Calls (|)
A piped call is an operator where the left operand is passed as the sole argument to the right operand.  The right operand must evaluate to a callable function.  These calls can be chained from left to right, where the result of each call is passed into the next right-hand operand.

```ruby
from array import join
from string import title
classes | join | title
```
