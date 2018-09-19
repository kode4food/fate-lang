const { mixin } = require('../dist/runtime');

mixin(
  exports,
  require('./api'),
  require('./cli'),
  require('./eval'),
  require('./pure'),
);
