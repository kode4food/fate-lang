---
layout: fate_title
title: Fate Programming
---
## Patterns & Guards & Joins, Oh My!
Fate is a programming language prototype that compiles into Node.js modules.  It is a mostly functional language, providing first-class patterns, invocation guards, list comprehensions, and flexible function application.

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

greetWith('hello') if person like Friend

unless processFinished
  'process some request'
end

if let a=getSomeValue(), b=getAnotherValue()
  # as they're not Nothing, do something with those values
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
  type: self in ['square', 'circle', 'triangle'],
  colors: 'orange' in self,
  size: self > 50
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

If you'd like more examples, you can always check out the scripts in the project's [Test Directory](https://github.com/kode4food/fate-lang/tree/master/test).

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

Or, if you're lazy:

```javascript
// require the Fate module
var fate = require('fatejs');
var resultingLambda = fate.evaluate('(x) -> x * 100');
console.log(resultingLambda(4));
```

## Resources
For source code and releases, see the [Fate GitHub Page](http://github.com/kode4food/fate-lang).

For language support in [Visual Studio Code](https://code.visualstudio.com/), install the [Fate Extension](https://marketplace.visualstudio.com/items/kode4food.fate).

For language support in [Sublime Text](http://www.sublimetext.com/), install the [Fate package](https://packagecontrol.io/packages/Fate) using [Package Control](https://packagecontrol.io/).
