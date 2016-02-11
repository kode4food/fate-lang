---
title: Introduction | A Guide to Fate
layout: fate_guide
prev: index
next: data
---
## A Fate Introduction
Fate is a programming language prototype that compiles into Node.js modules.  It is a mostly functional language, providing first-class patterns, invocation guards, list comprehensions, and flexible function application.

### Why Fate?

### Hello, Fate!
That's a lot to take in, so maybe it's better to just demonstrate.  Let's say you needed to calculate the NOx emissions for an OBD II reporting module.  You could do it the obvious way:

```ruby
def calculateVehicleEmissions(car)
  if car.wheelsInMotion > 2
    car.emissions
  else
    car.emissions / 40
  end
end
```

But that's a lot of `if` statements.  Yes, one is too many.  It also packs calculations for two different potential states into a single function, which will become more difficult to isolate if you should need to hide the second calculation from government auditors.  To correct this, you can break the function up and use a guard on its re-opened version.

```ruby
def calculateVehicleEmissions(car)
  car.emissions
end

def calculateVehicleEmissions(car) where car.wheelsInMotion <= 2
  car.emissions / 40
end
```

That's better!  Now if the EPA come to your place of business, you can simply delete the second function and they'll be none the wiser!  But that `where` clause is practically like another `if` statement, and we've already established that we don't like those.  So let's use an in-line pattern instead:

```ruby
def calculateVehicleEmissions(car)
  car.emissions
end

def calculateVehicleEmissions({ wheelsInMotion: self <= 2 } as car)
  car.emissions / 40
end
```

Better!  But now you have the pattern matching for qualifying cars in a place where it can't be reused.  Let's clean that up:

```ruby
def calculateVehicleEmissions(car)
  car.emissions
end

let VehicleUnderTest = ~{ wheelsInMotion: self <= 2 }

def calculateVehicleEmissions(VehicleUnderTest as car)
  car.emissions / 40
end
```

Done!  The problem of vehicle emissions testing is now solved!

## How to Install and Use
Assuming you've already installed a version of node.js 4.0 or greater, all you need to start writing Fate scripts is to install the fatejs npm package, like so:

```bash
npm -g install fatejs
```

**Note:** Depending on your operating system's permissions, you may have to use 'sudo' for this call to work.


This will link the command line interpreter (fate) into your PATH, allowing you to start Fate scripts directly from the command-line:

```bash
fate my_script.fate
```

It will also link the command line compiler (fatec) into your PATH, allowing you to convert Fate scripts into node.js modules.  Those modules can then be required like any other node module, but the `fatejs` module must be available to your project.

Because the Fate module registers an extension with node, you can also `require()` Fate scripts directly.  Just be sure to require the `fatejs` module before attempting to do so.

You can also compile scripts on the fly by requiring the fatejs module, and calling its compile function, like so:

```javascript
// require the Fate module
var fate = require('fatejs');

// compile a script that returns a lambda
var script = fate.compile('x -> x * 100');

// execute the compiled script, 
// will return the lambda instance
var resultingLambda = script();

// spit out the result of the lambda!
console.log(resultingLambda(4));
```

Or, if you're lazy:

```javascript
// require the Fate module
var fate = require('fatejs');
var resultingLambda = fate.evaluate('x -> x * 100');
console.log(resultingLambda(4));
```

#### Worth Noting
Like JavaScript, Fate is case-sensitive.  Additionally, the language requires new lines to separate statements (rather than semi-colons).  As a result, most operators must appear at the end of a line if an expression is going to span multiple lines.  For example, the following script will result in -10 because the 20 will be evaluated as-is and the `-` will be treated as a unary negation:

```ruby
20
- 10
```

Instead, do this to treat the two lines as a single expression, yielding 10 as its result:

```ruby
20 -
10
```
