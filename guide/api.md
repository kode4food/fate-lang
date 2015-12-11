---
title: A Guide to Fate
layout: fate_guide
prev: imports
next: system
---
## The Fate API
The primary Fate API is a single JavaScript module that exposes several functions for compiling and evaluating scripts.  The most important of these functions is `compile()`.

```javascript
var fate = require('fatejs');
var compiled = fate.compile(script);
compiled(context);
```

The purpose of this function is to compile script strings into executable JavaScript functions.  The context argument provided to the compiled script is an Object whose properties will be treated as globals.  If nothing is provided, a default Globals instance will be used.  Here is an example of using the `fate()` function:

```javascript
var fate = require('fatejs');
var script = fate.compile("name | 'Hello, %!'");
script({ name: 'World' }); //-> Hello, World!
```

There are several support structures and functions attached to the `fate()` function.  By default, they are as follows:

  * `compile(script)` - Compiles the specified source, producing a Function that can be used to invoke the compiled script.
  * `evaluate(script, [context])` - Compiles and evaluates the specified source against the provided context object.  By default, the context is a Globals instance provided by the `globals()` Function.
  * `globals([extensions])` - creates a new Fate Globals instance.
 
## Compilation
The `fate.evaluate()` function will parse, compile, and generate a Function for your script all in one pass.  But there are cases where you may want the compiled JavaScript for a script rather than a function.  In these cases, you'll want to call `fate.compile()`.

## Resolvers
A resolver is an interface used by Fate to resolve an imported module.  There are two available for developer use, they are the MemoryResolver and the FileResolver.

### Memory
A memory resolver allows you to register templates as named modules.  These templates can be strings to be compiled, compiled Fate Module functions, or Objects containing JavaScript functions.  An instance of this resolver is registered by default.  It can be accessed like so:

```javascript
fate.Runtime.registerModule('myModule',
  "def hello(name)\n" +
  '  {name} | "Hello, %name!"\n' +
  "end"
);
```

This will register a module with Fate's default Runtime instance.  You can then resolve the module in your script:

```ruby
from myModule import hello
hello('World')
```

### File (node.js only)
A file resolver allows you to treat a set of directories on disk as a source for your templates.  It's a little more complicated to use than the memory resolver because it accepts a base path, and so it's not registered by default.  To create one:

```javascript
var fate = require('fate');

fate.Resolvers.createFileResolver(fate.runtime(), {
  path: "./my_scripts"
});
```

If you wanted to import from a module named 'myModule', Fate will check for `./my_scripts/myModule.fate`.
