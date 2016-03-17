"use strict";

const mixin = require('../dist/Util').mixin;

mixin(exports,
  require('./slow'),
  require('./fast')
);
