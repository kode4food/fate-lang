"use strict";

const mixin = require('../dist/runtime').mixin;

mixin(exports,
  require('./slow'),
  require('./fast')
);
