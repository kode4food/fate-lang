# Fate (Patterns & Guards & Joins, Oh My!)
[![Build Status](https://travis-ci.org/kode4food/fate-lang.svg?branch=master)](https://travis-ci.org/kode4food/fate-lang)

Fate is a programming language prototype.  It currently compiles into Node.js modules, but the goal is to eventually have it target the JVM.  It is a mostly functional language that includes a processing model inspired by the [Join Calculus](https://en.wikipedia.org/wiki/Join-calculus).  It also provides first-class patterns, invocation guards, list comprehensions, and flexible partial application.

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

def calculateVehicleEmissions({ wheelsInMotion: ? <= 2 } as car)
  car.emissions / 40
end
```

Better!  But now you have the pattern matching for qualifying cars in a place where it can't be reused.  Let's clean that up:


```ruby
def calculateVehicleEmissions(car)
  car.emissions
end

let VehicleUnderTest = ~{ wheelsInMotion: ? <= 2 }

def calculateVehicleEmissions(VehicleUnderTest as car)
  car.emissions / 40
end
```

Done!  The problem of vehicle emissions testing is now solved!

## A Quick Tour
You've seen Functions and Patterns, but there's more to Fate than that.  Let's take a very quick look at some of those language features.

```ruby
# Imports
from SomeModule import displayString as display

import SomeModule as aModule
let display = aModule.displayString

# Branching Statements
if myAge > 50
  'should probably retire'
else
  'good to go'
end

unless processFinished
  'process some request'
end

# Branching Expressions
let result = 'green' unless turnedOff else 'red'

# For Loops, with Guards, Else Clauses, and Multiple Ranges
for color in colors where color != 'orange',
    shape in shapes where shape != 'square'
  {color, shape} | "A %color colored %shape" | display
else
  "No colored shapes were retrieved" | display
end

# List and Object Comprehensions
let result = [for color in colors
              where color != 'orange'
              select {color} | 'The color is %color']

let deidentified = {for name:value in person
                    where name not in ['name', 'address', 'ssn']}

# More Advanced Patterns
let LargeOrangeShape = ~{
  type: ? in ['square', 'circle', 'triangle'],
  colors: 'orange' in ?,
  size: ? > 50
}

if shape like LargeOrangeShape
  'bingo!'
end

# Join Processing
when userData(user) & err()
  # an error occurred fetching notifications
  # deal with the issue
end

when userData(user) & notificationData(notifications)
  # the user data and notifications were retrieved
  # do something about that
end

# Exporting from a module
export calculateVehicleEmissions as calculate
```

If you'd like more examples, you can always check out the scripts in the project's [Test Directory](./test).

## How to Install and Use
Until the first stable release happens, you're really pressing your luck to use this thing in production.  But if you're insane, you can install the compiler globally like so:

```bash
npm -g install fatejs
```

This will link the command line compiler (fatec) into your PATH, allowing you to convert Fate scripts into node.js modules.  Those modules can then be required like any other node module, but the `fatejs` module must be available to your project.

Because the Fate module registers an extension with node, you can also `require()` Fate scripts directly.  Just be sure to require the `fatejs` module before attempting to do so.

## The Fate Compilation API
You can also compile scripts manually by requiring the fatejs module, and calling its `compile()` function, like so:

```javascript
// require the Fate module
var fate = require('fatejs');

// compile a script that returns a lambda
var script = fate.compile('(x) -> x * 100');

// execute the compiled script,
// will return the lambda instance
var resultingLambda = script();

// spit out the result of the lambda!
console.log(resultingLambda(4));
```

Or, if you're lazy, you can skip the compile and execute steps, and just call `evaluate()`:

```javascript
var fate = require('fatejs');
var resultingLambda = fate.evaluate('(x) -> x * 100');
console.log(resultingLambda(4));
```

## Current Status
The prototype functions, but not much more.  There's quite a bit left to do in the areas of validation, optimization, and runtime library support.  See the [TODO](doc/TODO.md) document to get an idea.

## License (MIT License)
Copyright (c) 2015 Thomas S. Bradford

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
