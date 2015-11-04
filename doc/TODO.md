* There's no way to generate explicitly modified versions of Objects or Arrays. List comprehensions can only create filtered and mutated versions of a source item.  A clean syntax for doing this needs to be thought about.

* Pattern function arguments are currently compiled into first-class Functions and then invoked using a matcher.  This won't be particularly fast, so the next step is to inline the generated conditional code as part of the guard.

* The compiler should perform a bit more validation, especially where join arguments are concerned.

* Source Maps

* Documentation!
