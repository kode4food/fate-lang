const nodeunit = require('nodeunit');
const { evaluate } = require('../../dist/fate');

const testData = {
  name: 'World',
  title: 'Famous People',
  people: [
    { name: 'Larry', age: 50, brothers: [] },
    { name: 'Curly', age: 45, brothers: ['Moe', 'Shemp'] },
    { name: 'Moe', age: 58, brothers: ['Curly', 'Shemp'] },
  ],
};

exports.math = nodeunit.testCase({
  Numbers(test) {
    test.equal(evaluate('1.2E5'), 120000);
    test.equal(evaluate('1.2e+10'), 12000000000);
    test.equal(evaluate('1.5e-5'), 0.000015);
    test.equal(evaluate('-1.8e-2'), -0.018);
    test.done();
  },

  'Arithmetic Evaluation': (test) => {
    test.equal(evaluate('1 + 1'), 2);
    test.equal(evaluate('10 - 7'), 3);
    test.equal(evaluate('10 + 30 - 5'), 35);
    test.equal(evaluate('global.people[0].age + 10', testData), 60);
    test.equal(evaluate('60 - global.people[0].age', testData), 10);
    test.done();
  },

  'Multiplicative Evaluation': (test) => {
    test.equal(evaluate('10 * 99'), 990);
    test.equal(evaluate('100 / 5'), 20);
    test.equal(evaluate('99 mod 6'), 3);
    test.equal(evaluate('33 * 3 mod 6'), 3);
    test.equal(evaluate('global.people[0].age * 2', testData), 100);
    test.equal(evaluate('global.people[0].age / 2', testData), 25);
    test.equal(evaluate('100 / global.people[0].age', testData), 2);
    test.equal(evaluate('3 * global.people[0].age', testData), 150);

    test.equal(evaluate(`
      (33 * 6 - (global.people[0].age + 1)) mod 6
    `, testData), 3);

    test.done();
  },

  Functions(test) {
    test.equal(evaluate(`
      import math
      math.avg([1,2,3])
    `), 2);

    test.throws(() => {
      evaluate(`
        import math
        math.avg([])
      `);
    });

    test.throws(() => {
      evaluate(`
        import math
        math.avg(['non_num'])
      `);
    });

    test.throws(() => {
      evaluate(`
        import math
        math.avg('non_num')
      `);
    });

    test.throws(() => {
      evaluate(`
        import math
        math.avg(1)
      `);
    });

    test.equal(evaluate(`
      import math
      math.sum([1,2,3])
    `), 6);

    test.throws(() => {
      evaluate(`
        import math
        math.sum(5)`);
    });

    test.throws(() => {
      evaluate(`
        import math
        math.sum('non_num')`);
    });

    test.equal(evaluate(`
      import math
      math.max([1,9,7])`), 9);

    test.throws(() => {
      evaluate(`
        import math
        math.max(7)`);
    });

    test.throws(() => {
      evaluate(`
        import math
        math.max('non_num')`);
    });

    test.equal(evaluate(`
      import math
      math.median([1,9,7,50])
    `), 8);

    test.equal(evaluate(`
      import math
      math.median([1,9,7,50,6])
    `), 7);

    test.equal(evaluate(`
      import math
      math.median([9,1])
    `), 5);

    test.equal(evaluate(`
      import math
      math.median([9])
    `), 9);

    test.throws(() => {
      evaluate(`
        import math
        math.median(7)
      `);
    });

    test.throws(() => {
      evaluate(`
        import math
        math.median([])
      `);
    });

    test.throws(() => {
      evaluate(`
        import math
        math.median('non_num')
      `);
    });

    test.equal(evaluate(`
      import math
      math.min([1,9,7])
    `), 1);

    test.throws(() => {
      evaluate(`
        import math
        math.min(5)
      `);
    });

    test.throws(() => {
      evaluate(`
        import math
        math.min('non_num')
      `);
    });

    test.done();
  },
});
