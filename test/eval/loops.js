"use strict";

const nodeunit = require('nodeunit');
const fate = require('../../dist/Fate');
const evaluate = fate.evaluate;
const helpers = require('./helpers');
const evaluateEmit = helpers.evaluateEmit;

exports.loops = nodeunit.testCase({
  setUp: function (callback) {
    this.data = {
      "name": "World",
      "title": "Famous People",
      "people" : [
        { "name": "Larry", "age": 50, "brothers": [] },
        { "name": "Curly", "age": 45, "brothers": ["Moe", "Shemp"] },
        { "name": "Moe", "age": 58, "brothers": ["Curly", "Shemp"] }
      ]
    };

    callback();
  },

  "Basic Loops": function (test) {
    let script1 = `for color in ["red", "green", "blue"]
                   where color != "red": global.emit(color + " is a color")`;

    let script2 = `for color in []
                     global.emit(color + " is a color")
                   else
                     global.emit("No Colors")
                   end`;

    let script3 = `for color in 97
                     global.emit(color + " is a color")
                   end`;

    let script4 = `for name:value in {name:"Thom", age:42}
                     global.emit({ name, value } | "%name=%value")
                   end`;

    let script5 = `for person in global.people, brother in person.brothers
                     let name = person.name
                     global.emit({ name, brother } | "%name-%brother")
                   end`;

    let script6 = `for person in global.people
                     for brother in person.brothers
                       global.emit(person.name + "-" + brother)
                     else: global.emit("-")
                   end`;

    let script7 = `for person in global.people
                     for brother in person.brothers
                       let name = person.name
                       global.emit({ name, brother } | "%name-%brother")
                     end
                   end`;

    test.deepEqual(evaluateEmit(script1), ["green is a color", "blue is a color"]);
    test.deepEqual(evaluateEmit(script2), ["No Colors"]);
    test.deepEqual(evaluateEmit(script3), []);
    test.deepEqual(evaluateEmit(script4), ["name=Thom","age=42"]);
    test.deepEqual(evaluateEmit(script5, this.data),
                   ["Curly-Moe", "Curly-Shemp", "Moe-Curly", "Moe-Shemp"]);
    test.deepEqual(evaluateEmit(script6, this.data),
                   ["-", "Curly-Moe", "Curly-Shemp", "Moe-Curly", "Moe-Shemp"]);
    test.deepEqual(evaluateEmit(script7, this.data),
                   ["Curly-Moe", "Curly-Shemp", "Moe-Curly", "Moe-Shemp"]);
    test.done();
  },

  "Shadowing Loops": function (test) {
    let script5 = `let name = "Bobby"
                   for person in global.people, brother in person.brothers
                     let name = person.name
                     global.emit({ name, brother } | "%name-%brother")
                   end
                   global.emit(name)`;

    test.deepEqual(evaluateEmit(script5, this.data),
                   ["Curly-Moe", "Curly-Shemp", "Moe-Curly", "Moe-Shemp", "Bobby"]);

    test.done();
  },

  "Generator Loops": function (test) {
    let script1 = `from math import range
                   for i in range(1, 10)
                     global.emit(i)
                   end`;
    let script2 = `from math import range
                   for i in range(10, 2)
                     global.emit(i)
                   end`;
    let script3 = `from math import range
                   for i in range(5, -5)
                     global.emit(i)
                   end`;
    let script4 = `from math import range
                   for i in range(0, 0)
                     global.emit(i)
                   end`;
    let script5 = `from math import range
                   for i in range(0.5, 10.1)
                     global.emit(i)
                   end`;
    let script6 = `from math import range
                   [for i in range(1,10) select i * 2]`;
    let script7 = `from math import range
                   [for i in range(1,10) where i < 5]`;

    test.deepEqual(evaluateEmit(script1), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    test.deepEqual(evaluateEmit(script2), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    test.deepEqual(evaluateEmit(script3), [5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5]);
    test.deepEqual(evaluateEmit(script4), [0]);
    test.deepEqual(evaluateEmit(script5), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    test.deepEqual(evaluate(script6), [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    test.deepEqual(evaluate(script7), [1, 2, 3, 4]);
    test.done();
  },

  "Indexed Loops": function (test) {
    function* colors() {
      yield ["red", 0];
      yield ["green", 1];
      yield ["blue", 2];
    }

    let script1 = `[for idx:brother in global.people[2].brothers
                   select brother + ":" + idx]`;

    let script2 = '[for idx:color in global.colors() select color + ":" + idx]';

    let script3 = '[for color in 97]';
    let script4 = '{for x:y in 100}';

    test.deepEqual(evaluate(script1, this.data), ['Curly:0', 'Shemp:1']);
    test.deepEqual(evaluate(script2, {colors}), ['red:0', 'green:1', 'blue:2']);
    test.deepEqual(evaluate(script3), []);
    test.deepEqual(evaluate(script4), {});
    test.done();
  }
});
