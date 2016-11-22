"use strict";

const mixin = require('../dist/runtime').mixin;

mixin(exports,
  require('./eval'),
  require('./pure')
);
