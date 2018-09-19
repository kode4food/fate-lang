const nodeunit = require('nodeunit');
const { evaluate } = require('../../dist/fate');

exports.like = nodeunit.testCase({
  'Guard Patterns': (test) => {
    const script1 = `let p = ~{ name: it != 'Thom', age: it != 43 }
                   def func(person)
                     'normal person: ' + person.name
                   end
                   def func(p as person)
                     'non-Thom person: ' + person.name
                   end
                   func({ name: 'Bill', age: 42 })`;

    test.equal(evaluate(script1), 'non-Thom person: Bill');
    test.done();
  },

  'Object Patterns': (test) => {
    const script1 = `let p = ~{ name: it != 'Thom', age: it != 43 }
                   { name: 'Bill', age: 27 } like p`;

    const script2 = `let p = ~[_, { name: 'Thom', age: it > 20 }, 99]
                   ['crap', { name: 'Thom', age: 30 }, 99] like p`;

    const script3 = `let p = ~{ name: it != 'Thom', age: it != 43 }
                   { name: 'Thom', age: 27 } like p`;

    const script4 = `let p = ~{name: 'Thom', address: ~{ city: 'Boston' }}
                   {name: 'Thom', address: { street: '123 Main', city: 'Boston' }} like p`;

    test.equal(evaluate(script1), true);
    test.equal(evaluate(script2), true);
    test.equal(evaluate(script3), false);
    test.equal(evaluate(script4), true);
    test.done();
  },

  'Array Patterns': (test) => {
    const script1 = `let p = ~(it > 50 and it < 100)
                   p(75)`;

    const script2 = `let p = ~(it > 50 and it < 100)
                   75 like p`;

    const script3 = `let p = ~[12, _, 99]
                   [12, 88, 99] like p`;

    const script4 = `let p = ~(it like ~[12, _, 99] and it[1]=88)
                   [12, 88, 99] like p`;

    const script5 = `let p = ~[12, [1, _, 3]]
                   [12, [1, 5, 3], 24] like p`;

    const script6 = "'hello' like ~(it)";

    test.equal(evaluate(script1), true);
    test.equal(evaluate(script2), true);
    test.equal(evaluate(script3), true);
    test.equal(evaluate(script4), true);
    test.equal(evaluate(script5), true);
    test.equal(evaluate(script6), true);
    test.done();
  },

  'Like Matching': (test) => {
    const person1 = {
      name: 'Thom',
      age: 42,
      job: 'Developer',
      colors: ['red', 'green', 'blue'],
    };

    const person2 = {
      name: 'Thom',
      age: 42,
      colors: ['red', 'green', 'blue'],
    };

    const person3 = {
      name: 'Thom',
      age: 42,
      colors: ['red', 'green', 'yellow'],
    };

    const person4 = {
      name: 'Thom',
      colors: ['red', 'blue'],
    };

    const array = ['red', 'green', 'blue'];

    const data = {
      person1,
      person2,
      person3,
      person4,
      array,
      null_value: null,
    };

    const script1 = `if global.person1 like global.person2
                     "They match!"
                   end`;

    const script2 = `unless global.person1 like global.person3
                     "They don't match!"
                   end`;

    const script3 = `unless global.person1 like global.person4
                     "They don't match!"
                   end`;

    const script4 = `if global.array like ["red", "green", "blue"]
                     "They match!"
                   else
                     "They don't match!"
                   end`;

    const script5 = `unless global.person1 like {name: "Thom", age: 56}
                     "They don't match!"
                   end`;

    const script6 = `import pattern
                   pattern.Nothing like global.null_value`;

    const script7 = `import pattern
                   global.null_value like pattern.Nothing`;

    test.equal(evaluate(script1, data), 'They match!');
    test.equal(evaluate(script1, { person1: null }), 'They match!');
    test.equal(evaluate(script2, data), "They don't match!");
    test.equal(evaluate(script3, { person1, person3: 88 }),
               "They don't match!");
    test.equal(evaluate(script3, data), "They don't match!");
    test.equal(evaluate(script4, data), 'They match!');
    test.equal(evaluate(script4, { array: [] }), "They don't match!");
    test.equal(evaluate(script4, { array: ['blue', 'white', 'green'] }),
               "They don't match!");
    test.equal(evaluate(script5, data), "They don't match!");
    test.equal(evaluate(script5, { person1: null }), "They don't match!");

    test.equal(evaluate(script6, data), true);
    test.equal(evaluate(script7, data), true);
    test.equal(evaluate('global.person1 like global.person1', data), true);

    test.done();
  },
});
