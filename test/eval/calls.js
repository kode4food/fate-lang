const nodeunit = require('nodeunit');
const { evaluate } = require('../../dist/fate');

const testData = {
  name: ['title', 'case'],
  people: [
    { name: 'Bill', age: 19 },
    { name: 'Fred', age: 42 },
    { name: 'Bob', age: 99 },
  ],
};

exports.calls = nodeunit.testCase({
  'Left Calls': function leftCalls(test) {
    const script1 = `from string import title
                   from array import join
                   let formatted = title(join(global.name))
                   { formatted } | "Hello, %formatted!"`;

    test.equal(evaluate(script1, testData), 'Hello, Title Case!');

    test.done();
  },

  'Right Calls': function rightCalls(test) {
    const script1 = `from string import title
                   from array import join
                   let formatted = global.name | join | title
                   { formatted } | "Hello, %formatted!"`;

    const script2 = "['hello', 'there'] | '%1-%0'";

    test.equal(evaluate(script1, testData), 'Hello, Title Case!');
    test.equal(evaluate(script2), 'there-hello');

    test.done();
  },
});
