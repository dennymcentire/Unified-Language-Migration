var path = require('path');
var baseConf = require('./karma.conf.js');

module.exports = function(config) {
  baseConf(config);

  config.set({
    reporters: ['mocha', 'junit'],

    colors: false,

    autoWatch: false,

    browsers: ['PhantomJS'],

    singleRun: true,

    junitReporter: {
      outputDir: path.join('..', 'test-reports'),
      outputFile: 'report.xml'
    },

    mochaReporter: {
      colors: false
    }
  })
}
