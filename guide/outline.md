Introduction

Getting Started
  Installation
  Hello, World!

  The Module

    The module is the unit of currency in Fate.  

  Statements

    Fate programs consist of a series of statements.  There aren't too many types of statements, which makes the language relatively easy to learn. This section will be grouped in the order of those statements you're likely to use most frequently.

    Variable Assignment (let)

      let a = 99, b = 100, c = 101

      Static Single Assignment 

        Probably the single most important concept to understand about Fate is that it compiles down to something called Static Single Assignment Form.  What this means is that if you re-assign a variable that's in scope, the language will not simply overwrite the data the variable points to.  Instead, it will create an entirely new version of the variable, and leave the previous one intact.

        Normally, you wouldn't even notice this behavior, but it becomes particularly important when you create nested functions and joins. In JavaScript, re-assigning a variable from within a closure means that you overwrite the variable for everyone referring to it.  In Fate, this is not the case.  For Example:

        ```javascript
        function outer() {
          let x = 100;
          function inner() {
            x = x + 100;
          }
          inner();
          return x;  // will return 200
        }
        ```  

        ```ruby
        def outer
          let x = 100
          def inner
            let x = x + 100
          end
          inner()
          x  # will return 100
        end
        ```

        The reason for this is because Fate treats your code as if it's something like this:

        ```ruby
        def outer
          let x1 = 100
          def inner
            let x2 = x1 + 100
          end
          inner()
          x1  # will return 100
        end
        ```

    Functions

      TODO: THIS
      Functions are reusable procedures that can be applied in a variety of contexts, such as in loops and conditionals.  For example, one might write a function to render a list of items:

      ```ruby
      ```

      Functions are first-class elements of Fate, meaning they can be passed around and assigned to variables.

      Signatures
        guards

          The definition of a function can also be 're-opened' to apply guard clauses, or to shadow the function if no guard clause is provided.  The order in which functions are defined determines the order in which the guard clauses are evaluated, where the most recently defined will be evaluated first.  For example:

          ```ruby
          def renderList(people)
            <ul>
            for person in people, sibling in person.siblings
              renderItem(person.name, sibling)
            end
            </ul>
          end

          def renderList(people) where not people
            <b>"There are no people to render!"</b>
          end

          renderList(people)
          ```

          In this case, if `people` was an empty array, the second variation of renderList would be executed.  Otherwise control would fall-through to the first.  If the unguarded version of renderList had been defined last, it would shadow the previous definition, thus short-circuiting its possible evaluation.

          Re-opening a function applies only to the current scope (and any of its nested scopes).  If you import a function from a module and then re-open it with a guard, the re-opened version *will not* be applied globally.

        patterns

          Fate supports pattern matching capability in Function Definitions.  This facilitates what are essentially inline-guards.  For example:

          ```ruby
          def renderItem(type, name)
            "This is a %type named %name"
          end
          ```

          This function can be extended to deal with specific type values:

          ```ruby
          def renderItem('developer', name)
            <b>"Developers rock! Especially %name"</b>
          end
          ```

          In this case, no local argument name is bound to the value.  You can simply treat it as discarded.  On the other hand, sometimes you're performing matching against lists and you may need access to the entire list in the body of your function.  To do this, you can alias it like so:

          ```ruby
          def renderPerson([type='developer'] as person)
            person | '%name writes code'
          end

          def renderPerson([type='banker'] as person)
            person | '%name steals money'
          end

          let me = [name='Thom', type='developer', age=42]
          renderPerson(me)
          ```

    return statements

    for statements

    join declarations
      signatures
        guards
        patterns

    import statements

  conditional statements
    if statement
    unless statement
    trailing if/unless statement

  expressions

    right function calls (|)

    conditional operator (ternary)

    boolean (and / or)

    equality operators (=, !=, like)

    relational operators (<, >, <=, >=, in, 'not in')

    additive operators (+, -)

      The additive operators are `+` and `-`.

    multiplicative operators (*, /, mod)

      The multiplicative operators are `*`, `/`, and `mod` (modulo)

    patterns (~)
      expression patterns
      array patterns
      object patterns

    unary operators (-, +, not)

      Only three traditional unary operators are supported.  They are `-` for numeric negation, '+' for numeric conversion, and `not` for boolean *not* negation.

    string interpolations ("" {})

    member retrieval ([expr])

      Like in JavaScript, membership expressions allow you to drill into an Array or Object's properties or elements.

      ```ruby
      myList[0]
      myList[someIndex or 0]
      myObject.someProperty
      myObject['someProperty']
      ```

    functions calls
      function call binding

    collections
      arrays

        Arrays are a sequence of elements surrounded by square braces `[]` and separated by commas `,`.  The elements of an arrayy can only be accessed by numerical index.  These indexes are zero-based, meaning the first element is accessed with 0, and so on.

        ```ruby
        let a = [1 + 8]      # single item list containing the number 9
        let b = [5, 9 + 12]  # two item list containing 5 and 21

        a[0]                 # displays 9
        b[1]                 # displays 21
        ```

      objects

        Objects are a set of name/value pairs surrounded by curly braces `{}` and separated by commas `,`.  Both the names and values can be constructed using any valid expression.  If the name is an Identifier, it will be treated as a literal string.

        ```ruby
        {
          theMachine: 'Deep Thought',
          theAnswer: (28 - 7) * 2
        }
        ```

    comprehensions
      array
      object

    lambdas

    parens

    literals

      number

        Numeric Literals in Fate can only be represented as either real or integers, and only as decimals.  The following are acceptable numeric literals:

        ```ruby
        0
        103
        99.995
        19.123e12
        5.32e-5
        ```

      string

        Strings are a series of characters (letters and so on).  Fate provides two ways to represent strings: simple and multi-line.

        A simple string starts and ends with either a single or double quote, and does not break across multiple lines:

        ```ruby
        'This is a simple string'
        ```

        A multi-line string starts and ends with triple-quotes (''' or """) and may include line breaks:

        ```ruby
        '''
        This
        string
        spans
        multiple
        lines
        '''
        ```

        ##### Escaping
        Strings allow special characters to be included using an escaping method (a leading backslash `\`).  These characters are ones that would be difficult to represent as part of the string, such as a single quote or an embedded newline.

        | Escape | Description        |
        |:------:| ------------------ |
        | \\\    | A single backslash |
        | \"     | A double quote     |
        | \'     | A single quote     |
        | \b     | Bell               |
        | \f     | Form-Feed          |
        | \n     | Unix Newline       |
        | \r     | Carriage Return    |
        | \t     | Tab                |

      regular expressions


      boolean

        The value of a Boolean literal is either true or false, so that's how you write them: `true` or `false`.

      self

      identifier

        An Identifier is a name that can be used to retrieve a variable or member.  Fate Identifiers must start with one of the following characters: (a-zA-Z_$).  All characters thereafter may also include digits: (0-9).  Identifiers can not be any of the Fate reserved words.

      wildcard

      nil

        `nil` is how one would represent the absence of a value.  Fate coerces any JavaScript `null` or `undefined` value that it sees into a Nil.
