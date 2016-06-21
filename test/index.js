"use strict";

const mixin = require('../dist/Runtime').mixin;

mixin(exports,
  require('./slow'),
  require('./fast')
);
