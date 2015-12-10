"use strict";

var mixin = require('../build/Util').mixin;

mixin(exports,
  require('./slow'),
  require('./fast')
);
