"use strict";

var nodeunit = require('nodeunit');
var fate = require('../build/fate');
var evaluate = fate.evaluate;
var helpers = require('./helpers');
var evaluateEmit = helpers.evaluateEmit;

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
    var script1 = 'for color in ["red", "green", "blue"]\n' +
                  'where color != "red"\n' +
                  '  emit(color + " is a color")\n' +
                  'end';

    var script2 = 'for color in []\n' +
                  '  emit(color + " is a color")\n' +
                  'else\n' +
                  '  emit("No Colors")\n' +
                  'end';

    var script3 = 'for color in 97\n' +
                  '  emit(color + " is a color")\n' +
                  'end';

    var script4 = 'for name:value in {name:"Thom", age:42}\n' +
                  '  emit({ name, value } | "%name=%value")\n' +
                  'end';

    var script5 = 'for person in people, brother in person.brothers\n' +
                  '  let name = person.name\n' +
                  '  emit({ name, brother } | "%name-%brother")\n' +
                  'end';

    var script6 = 'for person in people\n' +
                  '  for brother in person.brothers\n' +
                  '    emit(person.name + "-" + brother)\n' +
                  '  else\n' +
                  '    emit("-")\n' +
                  '  end\n' +
                  'end';

    var script7 = 'for person in people\n' +
                  '  for brother in person.brothers\n' +
                  '    let name = person.name\n' +
                  '    emit({ name, brother } | "%name-%brother")\n' +
                  '  end\n' +
                  'end';

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
    var script5 = 'let name = "Bobby"\n' +
                  'for person in people, brother in person.brothers\n' +
                  '  let name = person.name\n' +
                  '  emit({ name, brother } | "%name-%brother")\n' +
                  'end\n' +
                  'emit(name)';

    test.deepEqual(evaluateEmit(script5, this.data),
                   ["Curly-Moe", "Curly-Shemp", "Moe-Curly", "Moe-Shemp", "Bobby"]);

    test.done();
  },

  "Generator Loops": function (test) {
    var script1 = "from math import range\nfor i in range(1, 10)\nemit(i)\nend";
    var script2 = "from math import range\nfor i in range(10, 2)\nemit(i)\nend";
    var script3 = "from math import range\nfor i in range(5, -5)\nemit(i)\nend";
    var script4 = "from math import range\nfor i in range(0, 0)\nemit(i)\nend";
    var script5 = "from math import range\nfor i in range(0.5, 10.1)\nemit(i)\nend";
    var script6 = "from math import range\n[for i in range(1,10) select i * 2]";
    var script7 = "from math import range\n[for i in range(1,10) where i < 5]";

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
      yield "red";
      yield "green";
      yield "blue";
    }

    var script1 = '[for idx:brother in people[2].brothers ' +
                  'select brother + ":" + idx]';

    var script2 = '[for idx:color in colors() select color + ":" + idx]';

    test.deepEqual(evaluate(script1, this.data), ['Curly:0', 'Shemp:1']);
    test.deepEqual(evaluate(script2, {colors}), ['red:0', 'green:1', 'blue:2']);
    test.done();
  },
});
