"use strict";

var fate = require('../build/fate');

fate.Util.mixin(exports,
  require('./slow'),
  require('./fast')
);
