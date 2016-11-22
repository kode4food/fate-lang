"use strict";

const glob = require('glob').sync;
const files = glob('*.js', { cwd: __dirname });

const blacklist = ['index', 'helpers'];

files.forEach(filename => {
  let baseName = filename.replace(/\.js$/, '');
  if ( blacklist.indexOf(baseName) !== -1 ) {
    return;
  }
  let key = baseName + " (eval)";
  let requireName = './' + baseName;
  exports[key] = require(requireName)[baseName];
});
