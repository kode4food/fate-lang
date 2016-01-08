"use strict";

var nodeunit = require('nodeunit');
var evaluate = require('../dist/Fate').evaluate;
var isNothing = require('../dist/Runtime').isNothing;

exports.lists = nodeunit.testCase({
  "List comprehensions": function (test) {
    var data = {
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

    var script1 = "[for y in yl select y * 2]";
    var script2 = "[for y in yl where y > 50 select y * 2]";
    var script3 = "[for y in yl, x in xl where x.friend = y select x.val * y]";
    var script4 = "{for y in yl where y > 50 select y * 2: y * 4}[102]";
    var script5 = "{for y in yl select (y): y * 2}[51]";
    var script6 = "{for y in yl select val: y}['val']";
    var script7 = "[for y in yl where y > 50]";
    var script8 = "{for name:value in zl where name >= 20}";

    test.deepEqual(evaluate(script1, data), [20,40,60,100,102,150,180,200]);
    test.deepEqual(evaluate(script2, data), [102,150,180,200]);
    test.deepEqual(evaluate(script3, data), [300,255,2250,1800]);
    test.equal(evaluate(script4, data), 204);
    test.equal(evaluate(script5, data), 102);
    test.equal(evaluate(script6, data), 100);
    test.deepEqual(evaluate(script7, data), [51,75,90,100]);

    var result = evaluate(script8, data);
    test.deepEqual(result, {
      "20": "that was twenty",
      "30": "that was thirty"
    });
    test.ok(!result.hasOwnProperty("10"));

    test.done();
  },

  "Arrays": function (test) {
    test.equal(evaluate("[9,8,'Hello',7,3][2]"), "Hello");
    test.equal(evaluate("import array\narray.length([9,8,'Hello',7,3])"), 5);
    test.equal(evaluate("[3 * 3, 2 * 4, 'Hel'+'lo', 14 / 2, 9 / 3][2]"), "Hello");
    test.equal(evaluate("import array\narray.length([1000])"), 1);

    test.throws(() => {
      evaluate("import array\narray.length(1000)");
    });

    test.done();
  },

  "Object Construction": function (test) {
    var data = {
      name: 'hello',
      value: 9
    };

    test.equal(evaluate("{name:'Thom',age:42}.age"), 42);
    test.equal(evaluate("{name:'Thom',age:21*2}.age"), 42);
    test.equal(evaluate("{age:21*2}.age"), 42);
    test.equal(evaluate("{name + '1': value + 1}['hello1']", data), 10);
    test.equal(evaluate("{name + '2': value + 1}['hello2']", data), 10);
    test.equal(evaluate('let a = "hello"\n{ "test": a }')['test'], 'hello');
    test.equal(evaluate('let a = "hello"\n{ a }["a"]'), 'hello');
    test.equal(evaluate('{ "hello" }["hello"]'), 'hello');

    test.done();
  },

  "Nested lists": function (test) {
    var base = "{" +
               "  name   : 'World'," +
               "  title  : 'Famous People', " +
               "  people : [" +
               "    { name : 'Larry', age : 50 }," +
               "    { name : 'Curly', age : 45 }," +
               "    { name : 'Moe', age : 58 }" +
               "  ]" +
               "}";

    test.equal(evaluate("" + base + ".title"), "Famous People");
    test.equal(evaluate("" + base + ".people[1].name"), "Curly");
    test.equal(evaluate("import array\narray.length(" + base + ".people)"), 3);
    test.done();
  },

  "Functions": function (test) {
    test.equal(evaluate("import array\narray.join(['this','is','fate'])"), "this is fate");
    test.equal(evaluate("import array\narray.join(['this','is','fate'], '-=-')"), "this-=-is-=-fate");

    test.throws(() => {
      evaluate("import array\narray.join('hello', '-=-')");
    });

    test.equal(evaluate("import array\narray.first([1,2,3])"), 1);
    test.equal(evaluate("import array\narray.first([9])"), 9);

    test.throws(() => {
      evaluate("import array\narray.first({name:'Bill',age:42})");
    });

    test.equal(evaluate("import array\narray.last([1,2,3])"), 3);
    test.equal(evaluate("import array\narray.last([])"), undefined);
    test.equal(evaluate("import array\narray.last([9])"), 9);

    test.throws(() => {
      evaluate("import array\narray.last({name:'Bill',age:42})");
    });

    test.equal(evaluate("import array\narray.length([1,2,3])"), 3);
    test.equal(evaluate("import array\narray.length([9])"), 1);

    test.equal(evaluate("import array\narray.empty([1,2,3])"), false);
    test.equal(evaluate("import array\narray.empty([])"), true);

    test.throws(() => {
      evaluate("import array\narray.empty(9)");
    });

    test.throws(() => {
      evaluate("import array\narray.empty({name:'Bill'})");
    });

    test.deepEqual(evaluate("import object\nobject.keys({name:'Thom',age:42})"), ['name','age']);

    test.throws(() => {
      evaluate("import object\nobject.keys(62)");
    });

    test.deepEqual(evaluate("import object\nobject.values({name:'Thom',age:42})"), ['Thom',42]);

    test.throws(() => {
      evaluate("import object\nobject.values(62)");
    });

    test.done();
  }
});
