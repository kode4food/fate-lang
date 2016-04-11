"use strict";

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const evaluate = require('../dist/Fate')['evaluate'];
const mixin = require('../dist/Util')['mixin'];

const usesFate = /^(['"])use fate\1$/g;

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

function isFateCompilation(filename) {
  return usesFate.test(fs.readFileSync(filename).toString());
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
}

// Exported Functions
exports.createConsole = createConsole;
exports.evaluateEmit = evaluateEmit;
exports.monkeyPatchRequires = monkeyPatchRequires;
