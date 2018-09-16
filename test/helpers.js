/** @flow */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const evaluate = require('../dist/fate').evaluate;
const mixin = require('../dist/runtime').mixin;

const usesFate = /(['"])fate\-compiler:[0-9.]+\1;/g;

/*
 * Creates a mock console, primarily for intercepting the results of the
 * Fate command-line tool
 */
function createConsole() {
  let buffer = [];
  let str;

  return {
    log: append,
    info: append,
    warn: append,
    error: append,
    result: result,
    contains: contains
  };

  function append(value) {
    buffer.push(value);
    str = null;
  }

  function result() {
    if ( !str ) {
      str = buffer.join('\n');
    }
    return str;
  }

  function contains(str) {
    return result().indexOf(str) !== -1;
  }
}

function evaluateEmit(script, data) {
  let result = [];
  evaluate(script, mixin({ emit: emit }, data));
  return result;

  function emit(value) {
    result.push(value);
  }
}

function monkeyPatchRequires(root, remappedPaths) {
  let files = glob.sync('**/*.js', { cwd: root });
  files.filter(isFateCompilation).forEach(function (file) {
    // Rewrite the file to point to the local Fate instance
    let filePath = path.join(root, file);
    let content = fs.readFileSync(filePath).toString();
    Object.keys(remappedPaths).forEach(function (originalPackage) {
      content = content.replace(
        "require('" + originalPackage + "')",
        "require('" + remappedPaths[originalPackage] + "')"
      );
    });
    fs.writeFileSync(filePath, content);
  });

  function isFateCompilation(file) {
    let filePath = path.join(root, file);
    return usesFate.test(fs.readFileSync(filePath).toString());
  }
}

// Exported Functions
exports.createConsole = createConsole;
exports.evaluateEmit = evaluateEmit;
exports.monkeyPatchRequires = monkeyPatchRequires;
