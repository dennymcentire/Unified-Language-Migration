var path = require('path');
var _ = require('underscore');
var karma = require('karma');

module.exports = {
  /**
   * The available environment configs
   * @type Object
   */
  envConfigs: {
    tdd: 'karma.conf.js',
    ci: 'karma.conf.ci.js'
  },

  /**
   * Instantiates a karma server
   * @param done {Function} Called when server is done
   * @param options {Object} Options passed to the karma server
   */
  factory: function(done, options) {
    return new karma.Server(options, done).start();
  },

  /**
   * Creates a karma server based off of the environment.
   * @param env {String} Config of the environment to load
   * @param done {Function} Callback used when karma is done
   * @param options {Options} Any additional options to pass to karma
   * @returns {Server} A Karma server object
   */
  create: function(env, done, options) {
    options = options || {};
    var buildFile;

    if (!(buildFile = this.envConfigs[env])) {
      throw new Error('No config was found for environment ' + env);
    }

    _.defaults(options, {
      configFile: path.join(__dirname, buildFile)
    });

    return this.factory(done, options);
  }
};

