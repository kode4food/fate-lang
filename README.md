# Fate (Patterns & Guards & Joins, Oh My!)
[![Build Status](https://travis-ci.org/kode4food/fate-lang.svg?branch=master)](https://travis-ci.org/kode4food/fate-lang)

Fate is a programming language that targets the V8 JavaScript VM.  It is a mostly functional language that provides first-class patterns, invocation guards, list comprehensions, flexible function application, and awesome concurrency.

For more information about Fate, you can visit the [Fate Language Site](http://www.fate-lang.org/).

For more information about the language itself, you can read the [Fate Programming Guide](https://kode4food.gitbooks.io/fate-lang/content/).

For examples of real code, you can check out the scripts in the project's [Test Directory](https://github.com/kode4food/fate-lang/tree/master/test).

## How to Install and Use
Until the first stable release happens, you're really pressing your luck to use this thing in production.  But if you're insane, you can install the language globally like so:

```bash
npm -g install fatejs
```

This will link the command line interpreter (fate) into your PATH, allowing you to start Fate scripts directly from the command-line:

```bash
fate my_script.fate
```

It will also link the command line compiler (fatec) into your PATH, allowing you to convert Fate scripts into node.js modules.  Those modules can then be required like any other node module, but the `fatejs` module must be available to your project.

Because the Fate module registers an extension with node, you can also `require()` Fate scripts directly.  Just be sure to require the `fatejs` module before attempting to do so.

## The Fate Compilation API
You can also compile scripts manually by requiring the fatejs module, and calling its `compile()` function, like so:

```javascript
// require the Fate module
var fate = require('fatejs');

// compile a script that returns a lambda
var script = fate.compile('x -> x * 100');

// execute the compiled script,
// will return the lambda instance
var resultingLambda = script();

// spit out the result of the lambda!
console.log(resultingLambda(4));
```

Or, if you're lazy, you can skip the compile and execute steps, and just call `evaluate()`:

```javascript
var fate = require('fatejs');
var resultingLambda = fate.evaluate('x -> x * 100');
console.log(resultingLambda(4));
```

## Current Status
The prototype functions, but not much more.  There's quite a bit left to do in the areas of validation, optimization, and runtime library support.  See the project's [GitHub Issues](https://github.com/kode4food/fate-lang/issues) page to get an idea.

## License (MIT License)
Copyright (c) 2015, 2106 Thomas S. Bradford

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
