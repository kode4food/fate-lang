const fs = require('fs');
const path = require('path');
const glob = require('glob');

const { evaluate } = require('../dist/fate');
const { mixin } = require('../dist/runtime');

const usesFate = /(['"])fate-compiler:[0-9.]+\1;/g;

/*
 * Creates a mock console, primarily for intercepting the results of the
 * Fate command-line tool
 */
function createConsole() {
  const buffer = [];
  let str;

  return {
    log: append,
    info: append,
    warn: append,
    error: append,
    result,
    contains,
  };

  function append(value) {
    buffer.push(value);
    str = null;
  }

  function result() {
    if (!str) {
      str = buffer.join('\n');
    }
    return str;
  }

  function contains(s) {
    return result().indexOf(s) !== -1;
  }
}

function evaluateEmit(script, data) {
  const result = [];
  evaluate(script, mixin({ emit }, data));
  return result;

  function emit(value) {
    result.push(value);
  }
}

function monkeyPatchRequires(root, remappedPaths) {
  const files = glob.sync('**/*.js', { cwd: root });
  files.filter(isFateCompilation).forEach((file) => {
    // Rewrite the file to point to the local Fate instance
    const filePath = path.join(root, file);
    let content = fs.readFileSync(filePath).toString();
    Object.keys(remappedPaths).forEach((originalPackage) => {
      content = content.replace(
        `require('${originalPackage}')`,
        `require('${remappedPaths[originalPackage]}')`,
      );
    });
    fs.writeFileSync(filePath, content);
  });

  function isFateCompilation(file) {
    const filePath = path.join(root, file);
    return usesFate.test(fs.readFileSync(filePath).toString());
  }
}

// Exported Functions
exports.createConsole = createConsole;
exports.evaluateEmit = evaluateEmit;
exports.monkeyPatchRequires = monkeyPatchRequires;
