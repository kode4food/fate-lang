# Change History

## Version 0.6.4 - Lambda Parsing Clarified
Lambdas with multiple arguments now require parentheses either around the arguments or around the entire lambda.  Lambdas with a single argument no longer require parentheses around the argument.

## Version 0.6.3 - Function and Pattern Composition
Functions and Patterns can be combined using the `and|` and `or|` operators.  The result of these operators will be a new Function that combines the behaviors of its operands.

## Version 0.6.2 - Operator Alternatives
The following operators can now, alternatively, be represented using more math-friendly symbols.

| Operator | Alternative | Description              |
|:--------:|:-----------:|--------------------------|
| <=       | ≤           | Less than or equal to    |
| >=       | ≥           | Greater than or equal to |
| ->       | →           | Lambda function          |
| *        | •           | Multiplication           |
| /        | ÷           | Division                 |

Most of the alternatives can be entered using standard key combinations, with the exception of the arrow.  The Fate extension for VSCode now supports snippets for creating lambdas that use the arrow symbol.

## Version 0.6.1 - Awaiting Right Calls
Three new operators have been introduced at the same level of associativity as the right call (`|`) operator.  They are designed to await the resolution of the left expression before passing it into the function on the right. They are: `.|` (await), `:|` (await all) and `?|` (await any).  Example:

```ruby
import io

let numbers = [100, 150, 400]
do
  # will eventually print '[ 200, 300, 800 ]'
  numbers | (arr -> [for x in arr select x | io.timeout]) :| (x -> x * 2)
          | io.print
end
```

## Version 0.6.0 - Global Variables Begone!
When a Fate compiled module is invoked, the programmer can supply an Object to it that will provide globally available data.  Before version 0.6, the keys in that Object would be resolved simply by retrieving an identifier that had not been explicitly declared.  There were a couple of drawbacks to this approach.  First, you couldn't retrieve keys that didn't match Fate's Identifier naming pattern.  Second, it made debugging a nightmare.

As of this version, Fate will explode violently if you refer to an Identifier that hasn't been explicitly declared.  Global variables can now be accessed via the 'global' constant.  Example:

```ruby
import io

global.greeting | io.print
```

Also, global functions like `print` and `timeout` are now part of the system module named `io`.

## Version 0.5.5 - Concurrency Enhanced
`do` has been enhanced with the ability to await multiple parallel resolutions.  If the `when` clause is used, these results are joined into a single block.  If `case` clauses are used, the first to be resolved wins and that block is executed.

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
