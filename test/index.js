"use strict";

var mixin = require('../dist/Util').mixin;

mixin(exports,
  require('./slow'),
  require('./fast')
);
