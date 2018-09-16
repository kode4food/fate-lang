/** @flow */

// Needed to enable Fate script require()
require('../../dist/fate');

const glob = require('glob').sync;
const files = glob('*.fate', { cwd: __dirname });

files.forEach(filename => {
  let baseName = filename.replace(/\.fate$/, '');
  let key = baseName + " (pure)";
  let requireName = './' + baseName;
  exports[key] = require(requireName).tests;
});
