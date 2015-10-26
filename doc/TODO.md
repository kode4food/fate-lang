* Static Single Assignment - Right now, enclosed variables are being guarded in child functions, but the ideal situation would be to not allow the parent function to present a mutated version of a variable after the fact.

* There's no way to generate explicitly modified versions of Objects or Arrays. List comprehensions can only create filtered and mutated versions of a source item.  A clean syntax for doing this needs to be thought about.

* Pattern function arguments are currently compiled into first-class Functions and then invoked using a matcher.  This won't be particularly fast, so the next step is to inline the generated conditional code as part of the guard.

* The compiler should perform a bit more validation, especially where join arguments are concerned.

* Documentation!
