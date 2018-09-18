/** @flow */

// Needed to enable Fate script require()
require('../../dist/fate');

const glob = require('glob').sync;

const files = glob('*.fate', { cwd: __dirname });

files.forEach((filename) => {
  const baseName = filename.replace(/\.fate$/, '');
  const key = `${baseName} (pure)`;
  const requireName = `./${baseName}`;
  exports[key] = require(requireName).tests;
});
