---
layout: fate_title
title: Why Did I Design Fate?
---
Right now you're saying "There are too many programming languages. Why do we need a new one?"  Good question!  Technically we don't, and we never have.  Programmers seemed to get on well enough writing machine code by hand, so why do we constantly seek productivity-increasing abstraction?  What's wrong with us that we value our time?  Have I answered your question?

## The Thing About Languages
The thing about statically typed languages is that one class of error, type mismatch, is eliminated during the compilation step.  That is, unless you're using some sort of IoC mechanism, which is more than happy to reintroduce those errors at Runtime.  But in any case, data structures being passed internally around a statically typed language can generally be assumed safe --- until they can't be.

Dynamic languages are a different ball of wax.  You can't catch type mismatches at the compile step, because there generally isn't one.  But you don't program dynamic languages the same way that you would a statically typed language.  'Duck typing' is the typical way to look at data structures in a dynamic language.  Meaning, if it looks like a duck, swims like a duck, and quacks like a duck, then it probably is a duck --- unless it's not.

When it comes to decoupled systems, particularly those types of systems that are passing JSON around, both programming approaches have failings:

* Statically typed languages will still need to perform quite a bit of work to map between arbitrary JSON structures and statically typed classes.  Otherwise the programmer has to jump through major hoops in order to extract and massage the data from the JSON graph into their own system.  In this respect, many statically typed languages would prefer a more dynamic approach to dealing with data on the wire.

* Dynamic languages can generally proceed with the duck typing approach, but validation still has to take place in order to maintain the integrity of the system, meaning that the programmer must perform quite a bit of extra work in traversals and checks.  But programmers are lazy.  In this respect, many dynamic languages would prefer a more static approach to dealing with data on the wire.

## Enter Patterns
So the goal of [Fate](http://www.fate-lang.org)'s design is to take the benefits of a dynamic, functional language, and extend them with a terse but powerful pattern system that can be leveraged to both validate and route arbitrary JSON graphs through a system.  Complementing this is a rather elegant concurrency model.

As an example, let's create a pattern:

```ruby
let Duck = ~{
  quack: /.+/,
  feathers: /.+/
}
```

Defining a pattern is as simple as using the tilde (`~`) operator before an expression.  In this case we're compiling a pattern out of an object literal.  The regular expressions are requiring that `quack` and `feathers` are non-empty strings, though there is also a predefined pattern called `NonEmptyString` that does the same thing.

Now let's create a function that applies that pattern:

```ruby
import io

def inTheForest(Duck as duck)
  duck.quack | io.print
  duck.feathers | io.print
end
```

The function `inTheForest()` takes one parameter named `duck`.  That parameter has a pattern attached to it.  What's important to understand here is that even though it *looks* like a static type annotation, it isn't.  What Fate will do with this is generate guard code for the function's prologue that will look something like this:

```javascript
let Duck = definePattern(function (value) {
  return isObject(value) && 
         /.+/.test(value.quack) && 
         /.+/.test(value.feathers); 
});

function inTheForest$0(duck) {
  if ( !Duck(duck) ) {
    return notExhaustive.apply(null, arguments);
  }
  io.print(duck.quack);
  io.print(duck.feathers);
}
```

Of course, that was a rather simple case, but you can probably see where this is going.  In the generated code, `notExhaustive()` is the internal function that is called if your guard-criteria is not met and your function is *not* augmenting an existing function by that name.

So now, if you call `inTheForest()`:

```ruby
let donald = {
  quack: "Quaaaaaack!",
  feathers: "The duck has white and gray feathers."
}

inTheForest(donald)
```

You should see:

```
Quaaaaaack!
The duck has white and gray feathers.
```

But what if you called it with something that doesn't match the Duck pattern?

```ruby
let fred = {
  quack: "Quaaaaaack!",
  skin: "Fred is covered in pasty white skin"
}

inTheForest(fred)
```

In this case your program will explode with "Error: Function invocation not exhaustive" because no version of `inTheForest()` can handle non-Ducks.  You can correct this though:

```ruby
let Person = ~{
  quack: /.+/,
  skin: /.+/
}

def inTheForest(Person as person)
  person.quack | io.print
  person.skin | io.print
end
```

Now both Ducks and Persons can be handled.  The generated code will look something like this:

```javascript
let Person = definePattern(function (value) {
  return isObject(value) && 
         /.+/.test(value.quack) && 
         /.+/.test(value.skin); 
});

function inTheForest$1(person) {
  if ( !Person(person) ) {
    return inTheForest$0.apply(null, arguments);
  }
  io.print(person.quack);
  io.print(person.skin);
}
```

You can even write a function that will handle Wereducks.

```ruby
let Wereduck = Duck and> Person

def inTheForest(Wereduck as scary)
  "the moon is full, beware the Wereduck" | io.print
end
```

This example is leveraging the function combination operator `and|` to generate a new pattern that combines the `Duck` and `Person` patterns into a new one.

## Pulling It All Together
Now let's introduce one of our concurrency features to contextualize what we've just learned.

```ruby
import http, json

do when [content, err] = http.get('http://localhost:8000/ducks/1')
  content | json.parse | inTheForest
end
```

`do` kicks off an asynchronous block.  The code within that block will be performed when the assignments for the block have finally been resolved, specifically the result of the `http.get` request.  It is at that point when the content of the result will be piped through the JSON parser and finally into our `inTheForest()` function, where the proper variant of the function is executed depending on the JSON content.

## Static Single Assignment Form
One thing you'll notice about the generated code above is that there are names that end with `$0` and `$1`.  The reason for this is that Fate compiles down to something called [Static Single Assignment (SSA) Form](https://en.wikipedia.org/wiki/Static_single_assignment_form).

As a result, the identifiers in generated code will always have a '$<n>' suffix that uniquely isolates them within their module.  This means that if you re-assign a variable, the original version(s) will not be mutated, making Fate a language that is inherently resistant to side-effects.
