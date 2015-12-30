---
title: Looping | A Guide to Fate
layout: fate_guide
prev: branching
next: functions
---
## Looping Over Data
For loops allow one to iterate over sets of items.  For example:

```ruby
for person in people
  renderItem(person)
end
```

In this example, a new scope is created.  The loop then iterates over all elements in `people`.  For each element, a variable called `person` is assigned and the statement block that invokes `renderItem` is executed.

### Nested Loops
You can also nest loops:

```ruby
for person in people, brother in person.brothers
  renderItem(person, brother)
end
```

In this example, the outer loop iterates over all elements in `people`, assigning the identifier `person` to each element.  For each `person` item, an inner loop is executed that iterates over the person's `brothers` property, assigning the identifier `brother` to each element.  You'll notice that `person` is available in the inner loop's scope and that both identifiers are available in the statement block.

### Else Clauses
You can also define an `else` clause for those cases where the for loop finds no matches:

```ruby
for person in people, brother in person.brothers
  renderItem(person, brother)
else
  "I got nothin'!"
end
```

### Guards
This becomes especially important if you apply guards to your ranges:

```ruby
for person in people where person.type = 'stooge',
    brother in person.brothers where brother.living
  renderItem(person, brother)
else
  "I got nothin'!"
end
```

## Array Comprehensions
Now take everything you've just learned about looping using statements and let's turn that knowledge to the task of transforming lists.  An Array Comprehension allows you to iterate over a set, filtering and transforming it into a new Array, and it supports nearly all of the functionality of the `for` statement.

### Filtering
First, let's assume you have an array of colors.

```ruby
let colors = ['red', 'orange', 'yellow', 'green', 
              'blue', 'indigo', 'violet']
```

What if we want only the colors consisting of six letters?  In a normal loop, we'd do something like this:

```ruby
for c in colors where c.length = 6
  c
end
```

This will display the array, but not create a new one.  We can do that with an Array Comprehension as you see here:

```ruby
let c6 = [for c in colors where c.length = 6]
c6  #-> orange yellow ingido violet
```

### Transforming
You can also transform the results.  Let's say you need to modify the color names:

```ruby
from string import title
let c6 = [for c in colors where c.length = 6 select title(c)]
c6  #-> Orange Yellow Indigo Violet
```

### Object Comprehensions
Even better, you can create Objects from Arrays and vice-versa:

```ruby
from string import title
let c6 = {
  for c in colors where c.length = 6
  select c + '_key': title(c)
}
# c6 is now [orange_key='Orange', yellow_key='Yellow', ...
```

With the exception of `else` clauses and statement blocks, all aspects of `for` loops are supported, even nested ranges!
