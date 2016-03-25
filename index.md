---
layout: fate_title
title: Fate Programming
---
## Patterns & Guards & Joins, Oh My!
Fate is a programming language that targets the V8 JavaScript JVM.  It is a mostly functional language that provides first-class patterns, invocation guards, list comprehensions, flexible function application, and awesome concurrency.

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

### Branching Statements and Expressions

```ruby
# Ye Olde 'If' Statement
if myAge > 50
  'should probably retire'
else
  'good to go'
end

# Syntactic sugar for 'if not'
unless processFinished
  'process some request'
end

# Suffix 'if' (can also do unless)
greetWith('hello') if person like Friend

# The 'if let' statement
if let a=getSomeValue(), b=getAnotherValue()
  # as they're not Nothing, do something with those values
end  

# Branching Expressions
let result = 'green' unless turnedOff else 'red'
```

### Iteration And Reducing

```ruby
# For Loops, with Guards, Else Clauses, and Multiple Ranges
for color in colors where color != 'orange',
    shape in shapes where shape != 'square'
  {color, shape} | "A %color colored %shape" | display
else
  "No colored shapes were retrieved" | display
end

# Reduce Statement (Multiple Components)
reduce sum = 0, count = 0
for value in [1, 2, 3, 4, 5, 6, 7]
where value < 4
  let count = count + 1
  let sum = sum + value
end
let average = sum / count
 
# Reduce Expression (in a multi-line Lambda)
let sum = (values ->
  reduce result = 0
  for value in values
  select result + value
)

# List and Object Comprehensions
let result = [for color in colors 
              where color != 'orange'
              select {color} | 'The color is %color']

let deidentified = {for name:value in person
                    where name not in ['name', 'address', 'ssn']}
```

### Patterns and Destructuring

```ruby
# More Advanced Patterns
let LargeOrangeShape = ~{
  type: self in ['square', 'circle', 'triangle'],
  colors: 'orange' in self,
  size: self > 50
}

if shape like LargeOrangeShape
  'bingo!'
end

# Destructuring Assignment
let person = { name: 'Bill', age: 43 }
let { name, age as yearsOnEarth } = person

let numbers = [1, 2, 3]
let [ first, second, third ] = numbers
```

### Concurrency Expressions

```ruby
# A basic 'do' expression
let name = do
  'World'
end

do
  {name: await name} | "Hello, %name!" | print
end

let eventualResult = do
  case name
    print("name resolved first")
    name
  end

  case [content, _] = http.get("http://www.example.org/")
    print("http content resolved first")
    content
  end

  case timeout(100)
    print("couldn't get name or http content in 100ms")
  end
end
```

### Importing From/Exporting To A Module

```ruby
# Importing into a module
from SomeModule import displayString as display

import SomeModule as aModule
let display = aModule.displayString

# Exporting from a module
export calculateVehicleEmissions as calculate
```

## Resources
For source code and releases, see the [Fate GitHub Page](http://github.com/kode4food/fate-lang).

For more information about the language itself, you can read the [Fate Programming Guide](https://kode4food.gitbooks.io/fate-lang/content/).

For examples of real code, you can check out the scripts in the project's [Test Directory](https://github.com/kode4food/fate-lang/tree/master/test).

For language support in [Visual Studio Code](https://code.visualstudio.com/), install the [Fate Extension](https://marketplace.visualstudio.com/items/kode4food.fate).

For language support in [Sublime Text](http://www.sublimetext.com/), install the [Fate package](https://packagecontrol.io/packages/Fate) using [Package Control](https://packagecontrol.io/).
