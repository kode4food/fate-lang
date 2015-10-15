* Iteration is still performed synchronously.  The next step is to use generators.

* Pattern function arguments are currently compiled into first-class Functions and then invoked using a matcher.  This won't be particularly fast, so the next step is to inline the generated conditional code as part of the guard.

* The compiler should perform a bit more validation, especially where join arguments are concerned.

* Documentation!
