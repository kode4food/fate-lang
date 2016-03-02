# Change History

## Version 0.5.0 - Concurrency Simplified
The Join Syntax (`when`) has been removed, replaced with a much more capable model based somewhat on Haskell's IO Monad.  Keywords added to support this are: `do`, `await`, `any`, and `all`.

## Version 0.4.0 - Reduce Statements and Expressions
Because Fate uses static single assignment form, there was no way to mutate values through a loop except using the `mutable()` hack, resulting in very unsafe code.  `reduce` statements and expressions address this limitation by introducing loop-safe managed values that continue to respect SSA Form.

## Version 0.3.0 - So Many Of Stuff!
* Compiler modularized (Visitor, Checker, Patterns, Rewriter)
* 'self' Keyword for recursive Function calling
* '?' renamed to 'self' for Expressions within Patterns
* If no Signature of a Function or Channel can match its arguments, then an uncaught runtime exception will be raised.
* Certain statements can accept a trailing if/unless clause.
* Regular Expression Patterns (ex: `"Value" like /^[Vv]al(ue)?$/`)
* Added a System Module called 'patterns' with many useful basic Patterns
* 'if let' assigns a value and, if it matches the `pattern.Something` Pattern, executes the branch (ex: `if let a=getValue(), b=getAnother() ...`)
* Various bug fixes

## Version 0.2.0 - Static Single Assignment Form
Introduced Static Single Assignment Form to the compiled JavaScript IR.  This means that hoisting is no longer an option, so nested Functions need to be declared before they're used.  It also means that the value of a variable when a nested Function is declared will not change, even if it is eventually re-bound.

## Version 0.1.0 - Initial Release / Prototype
This is the initial release of the Fate Language Prototype.  There's still quite a lot to do and probably more than a few bugs, but it's at a stage now where it's somewhat usable.
