"use strict";

const nodeunit = require('nodeunit');
const evaluate = require('../dist/Fate').evaluate;

exports.lists = nodeunit.testCase({
  "List comprehensions": function (test) {
    let data = {
      yl: [10, 20, 30, 50, 51, 75, 90, 100],
      xl: [
        { val: 5, friend: 51 },
        { val: 10, friend: 30 },
        { val: 20, friend: 90 },
        { val: 30, friend: 75 }
      ],
      zl: {
        "10": "that was ten",
        "20": "that was twenty",
        "30": "that was thirty"
      }
    };

    let script1 = "[for y in global.yl select y * 2]";
    let script2 = "[for y in global.yl where y > 50 select y * 2]";
    let script3 = "[for y in global.yl, x in global.xl where x.friend = y select x.val * y]";
    let script4 = "{for y in global.yl where y > 50 select y * 2: y * 4}[102]";
    let script5 = "{for y in global.yl select (y): y * 2}[51]";
    let script6 = "{for y in global.yl select 'val': y}['val']";
    let script7 = "[for y in global.yl where y > 50]";
    let script8 = "{for name:value in global.zl where name >= 20}";

    test.deepEqual(evaluate(script1, data), [20,40,60,100,102,150,180,200]);
    test.deepEqual(evaluate(script2, data), [102,150,180,200]);
    test.deepEqual(evaluate(script3, data), [300,255,2250,1800]);
    test.equal(evaluate(script4, data), 204);
    test.equal(evaluate(script5, data), 102);
    test.equal(evaluate(script6, data), 100);
    test.deepEqual(evaluate(script7, data), [51,75,90,100]);

    let result = evaluate(script8, data);
    test.deepEqual(result, {
      "20": "that was twenty",
      "30": "that was thirty"
    });
    test.ok(!result.hasOwnProperty("10"));

    test.done();
  },

  "Arrays": function (test) {
    test.equal(evaluate("[9,8,'Hello',7,3][2]"), "Hello");
    test.equal(evaluate("[3 * 3, 2 * 4, 'Hel'+'lo', 14 / 2, 9 / 3][2]"), "Hello");

    test.equal(evaluate(`
      import array
      array.length([9,8,'Hello',7,3])
    `), 5);

    test.equal(evaluate(`
      import array
      array.length([1000])
    `), 1);

    test.throws(function () {
      evaluate(`
        import array
        array.length(1000)
      `);
    });

    test.done();
  },

  "Object Construction": function (test) {
    let data = {
      name: 'hello',
      value: 9
    };

    test.equal(evaluate("{name:'Thom',age:42}.age"), 42);
    test.equal(evaluate("{name:'Thom',age:21*2}.age"), 42);
    test.equal(evaluate("{age:21*2}.age"), 42);
    test.equal(evaluate("{global.name + '1': global.value + 1}['hello1']", data), 10);
    test.equal(evaluate("{global.name + '2': global.value + 1}['hello2']", data), 10);
    test.equal(evaluate('{ "hello" }["hello"]'), 'hello');

    test.equal(evaluate(`
      let a = "hello"
      { "test": a }
    `)['test'], 'hello');

    test.equal(evaluate(`
      let a = "hello"
      { a }["a"]
    `), 'hello');

    test.done();
  },

  "Nested lists": function (test) {
    let base = `{
                  name   : 'World',
                  title  : 'Famous People',
                  people : [
                    { name : 'Larry', age : 50 },
                    { name : 'Curly', age : 45 },
                    { name : 'Moe', age : 58 }
                  ]
                }`;

    test.equal(evaluate(`${base}.title`), "Famous People");
    test.equal(evaluate(`${base}.people[1].name`), "Curly");

    test.equal(evaluate(`
      import array
      array.length(${base}.people)
    `), 3);

    test.done();
  },

  "Functions": function (test) {
    test.equal(evaluate(`
      import array
      array.join(['this','is','fate'], '-=-')
    `), "this-=-is-=-fate");

    test.equal(evaluate(`
      import array
      array.join(['this','is','fate'])
    `), "this is fate");

    test.throws(function () {
      evaluate(`
        import array
        array.join('hello', '-=-')
      `);
    });

    test.equal(evaluate(`
      import array
      array.first([1,2,3])
    `), 1);

    test.equal(evaluate(`
      import array
      array.first([9])
    `), 9);

    test.throws(function () {
      evaluate(`
        import array
        array.first({name:'Bill',age:42})
      `);
    });

    test.equal(evaluate(`
      import array
      array.last([1,2,3])
    `), 3);

    test.equal(evaluate(`
      import array
      array.last([])
    `), undefined);

    test.equal(evaluate(`
      import array
      array.last([9])
    `), 9);

    test.throws(function () {
      evaluate(`
        import array
        array.last({name:'Bill',age:42})
      `);
    });

    test.equal(evaluate(`
      import array
      array.length([1,2,3])
    `), 3);

    test.equal(evaluate(`
      import array
      array.length([9])
    `), 1);

    test.equal(evaluate(`
      import array
      array.empty([1,2,3])
    `), false);

    test.equal(evaluate(`
      import array
      array.empty([])
    `), true);

    test.throws(function () {
      evaluate(`
        import array
        array.empty(9)
      `);
    });

    test.throws(function () {
      evaluate(`
        import array
        array.empty({name:'Bill'})
      `);
    });

    test.deepEqual(evaluate(`
      import object
      object.keys({name:'Thom',age:42})
    `), ['name','age']);

    test.throws(function () {
      evaluate(`
        import object
        object.keys(62)
      `);
    });

    test.deepEqual(evaluate(`
      import object
      object.values({name:'Thom',age:42})
    `), ['Thom',42]);

    test.throws(function () {
      evaluate(`
        import object
        object.values(62)
      `);
    });

    test.done();
  }
});
