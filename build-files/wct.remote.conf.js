var os = require('os');
var _ = require('underscore');
var config = require('../wct.conf');
var overrides = {
  plugins: {
    local: false,
    sauce: false
  },

  activeBrowsers: [{
    url: 'http://seleniumhub:4443/wd/hub',
    browserName: 'chrome'
  }],

  webserver: {
    hostname: os.hostname(),
    port: 20000
  },

  persistent: false,

  verbose: true
};

module.exports = _.extend({}, config, overrides);
