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
  <b>"Developers rock! Especially %name"</b>
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

### Function and Partial Calls
Like a function call in JavaScript.  A library function will either produce some script output or return a value, depending on its purpose.  A function will aways return `Nil`.

```ruby
for item in list
  printItem(item)
end
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
