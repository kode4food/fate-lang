---
title: Patterns | A Guide to Fate
layout: fate_guide
prev: interpolation
next: branching
---
## Patterns
Patterns are the magic gravy that makes Fate what it is.  In fact, they're why Fate exists.  Let me explain: Over the past years, I've been developing systems that are highly decoupled and heavily reliant on message queues.  Almost exclusively, the data being passed around is JSON.

Don't get me wrong, JSON is great, but because it's a format designed to transport arbitrary data, it lacks the ability to implicitly convey information about higher level language constructs or validity.  This might suck, unless you have a way to infer something about the data you're seeing, and that's where Patterns enter the picture.

A Pattern looks like this:

```ruby
~42  # this will match the number 42
```

A Pattern could also look like this:

```ruby
# this will match all numbers greater 
# than 30 and less than or equal to 100
~(self > 30 and self <= 100)
```

Try this Pattern on for size:

```ruby
let Primate = ~{
  kingdom: 'Animalia',
  class: 'Mammalia',
  order: 'Primate'
}

let MonkeyWithFourAsses = ~({ asses: 4 } and self like Primate)
```
