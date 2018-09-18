const glob = require('glob').sync;

const files = glob('*.js', { cwd: __dirname });

const blacklist = ['index'];

files.forEach((filename) => {
  const baseName = filename.replace(/\.js$/, '');
  if (blacklist.indexOf(baseName) !== -1) {
    return;
  }
  const key = `${baseName} (eval)`;
  const requireName = `./${baseName}`;
  exports[key] = require(requireName)[baseName];
});
