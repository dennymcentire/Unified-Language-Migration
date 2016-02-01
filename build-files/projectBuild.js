var browserUnpack = require("browser-unpack");
var deamdify = require("deamdify");

var hbsfy = require("hbsfy").configure({
  extensions: ['html','hbs'],
  compiler: "require('handlebars')"
});
var browserify = require('browserify');
var rename = require('gulp-rename');
var glob = require('glob');
var less = require('gulp-less');
var _ = require("underscore");
var fs = require("fs");
var source = require('vinyl-source-stream');
var path = require('path');
var livereload = require('gulp-livereload');
var merge = require('merge-stream');
var mocha = require('gulp-mocha');
var chai = require('chai');
var runSequence = require('run-sequence');

var uglify = require('gulp-uglify');
var gStreamify = require('gulp-streamify');//needed because gulp-uglify doesn't support streaming.

var jsBaseDir = './src/main/ui/js';
var jsDistDir = './target/classes/static/js';

var jsTestPattern = './src/test/**/*.js';

var lessBaseDir = './src/main/ui/less/**/*.less';
var lessDistDir = './target/classes/static/css';

var htmlBaseDir = './node_modules/core-front-end/polymer/**/*.html';
var htmlUiBaseDir = './src/main/ui/html/**/*.html';
var htmlDistDir = './target/classes/static/html';

var fontsBaseDir ='./node_modules/core-front-end/fonts/**/*';
var fontsDistDir = './target/classes/static/fonts';

var imagesBaseDir= './node_modules/core-front-end/images/**/*';
var imagesDistDir = './target/classes/static/images';

var vendorBaseDir = './node_modules/core-front-end/js/vendor';
var polymerLessDir = './node_modules/core-front-end/less/components/polymer/*.less';
var polymerBaseDir = vendorBaseDir + '/polymer/**/*';
var polymerPromiseDir = vendorBaseDir + '/promise-polyfill/**/*';

var handlebarsTemplatesBaseDir='./node_modules/core-front-end/handlebars/templates/**/*';
var handlebarsTemplatesDistDir='./target/classes/templates/handlebars/core';
var handlebarsTemplatesPageDistDir='./target/classes/templates/handlebars/'+path.basename(path.resolve('./'));
var handlebarsTemplatesPageDir='./src/main/resources/templates/handlebars/**/*';

var jsComponentsDir='./node_modules/core-front-end/components/**/*';
var jsComponentsDistDir='./src/main/ui/js/pages/components';
var distDir = fs.existsSync('./node_modules/core-front-end/dist/core.js') ? 'dist' : 'release';

var minimist = require('minimist');
var knownOptions = {
  string: ['testReporter'],
  default: {
    testReporter: 'spec'
  }
};

var options = minimist(process.argv.slice(2), knownOptions);


var defaultBuildConfig = {
  vendorBaseDir: vendorBaseDir,
  jsPagesDir: jsBaseDir + '/pages',
  fontsBaseDir: fontsBaseDir,
  fontsDistDir: fontsDistDir,
  imagesBaseDir: imagesBaseDir,
  imagesDistDir: imagesDistDir,
  jsBaseDir: jsBaseDir,
  jsDistDir: jsDistDir,
  handlebarsTemplatesBaseDir: handlebarsTemplatesBaseDir,
  handlebarsTemplatesDistDir: handlebarsTemplatesDistDir,
  handlebarsTemplatesPageDir: handlebarsTemplatesPageDir,
  handlebarsTemplatesPageDistDir: handlebarsTemplatesPageDistDir,
  lessPagesDir: lessBaseDir + '/pages',
  lessBaseDir: lessBaseDir,
  polymerBaseDir: polymerBaseDir,
  polymerPromiseDir: polymerPromiseDir,
  polymerLessDir: polymerLessDir,
  lessDistDir: lessDistDir,
  htmlBaseDir: htmlBaseDir,
  htmlUiBaseDir: htmlUiBaseDir,
  htmlDistDir: htmlDistDir,
  corejsSrcMatchPattern: './node_modules/core-front-end/'+distDir+'/core.js',
  corejsDistPath: jsDistDir,
  coreCssSrcMatchPattern: './node_modules/core-front-end/' + distDir + '/**.css',
  coreCssDistPath: lessDistDir,
  analyticsjsSrcMatchPattern: './node_modules/core-front-end/' + distDir + '/analytics.js',
  jsComponentsDir: jsComponentsDir,
  jsComponentsDistDir: jsComponentsDistDir,

  jsTest: { // https://www.npmjs.com/package/gulp-mocha
    pattern: jsTestPattern,
    config: { // Config for Mocha Tests: http://mochajs.org/
      reporter: options.testReporter,
      reporterOptions: {
        output: './test-reports/report.xml' // Output file for report (only used with certain reporters, namely xunit)
      }
    }
  },

  //http://lisperator.net/uglifyjs/codegen
  uglify:{
    mangle:true,
    output:{  //http://lisperator.net/uglifyjs/codegen
      beautify: false,
      quote_keys: true  //this is needed because when unbundling/browser unpack, the defined modules need to be strings or we wont know what their names are.
    }
    //compress:false // we can refine if needed. http://lisperator.net/uglifyjs/compress
  }
};

/**
 * Common project build steps. You can choose to
 * @param gulp
 * @param buildConfig - optional object to override defaultBuildConfig
 */
module.exports = function(gulp, buildConfig){
  runSequence = runSequence.use(gulp);

  buildConfig = _.extend({}, defaultBuildConfig, buildConfig);
  // console.log('buildConfig: ' + JSON.stringify(buildConfig, null, 4));


  /**
   * Builds page js files.
   * There's a bug with gulp that prevents me doing this the "right" way using gulp.src
   * https://github.com/wearefractal/vinyl-fs/issues/25
   */
  gulp.task("build:page-js", function() {
    //console.log('dirName: ' + __dirname);
    var coreFilePath = glob.sync(buildConfig.corejsSrcMatchPattern)[0];
    //unpack the bundled core.js to grab all the row/module ids so we can flag them as external and not include them in the app bundle.
    var src = fs.readFileSync(coreFilePath, 'utf8');
    var coreBundleRows = browserUnpack(src);
    //console.log('bundled rows: ' + JSON.stringify(coreBundleRows.length));
    var coreBundleModuleIds = _.pluck(coreBundleRows, 'id');


    function browserifyIt(filePath, outputName){
      console.log('building page: ' + outputName + ' from path: ' + filePath);
      var bundler = browserify({
        entries: [filePath],
        transform: [hbsfy] // We want to convert Handlebars templates  to normal javascript
      })
          .external(coreBundleModuleIds); //exclude modules defined inside of core.js

      return bundler.bundle()
          .on("error", function(){ console.log(arguments)})
          .pipe(source(outputName))
          .pipe(gStreamify(uglify(buildConfig.uglify)))
          .pipe(gulp.dest(buildConfig.jsDistDir));
    }


    //read each page js(x) file from the pages dir and build it
    var files = glob.sync(buildConfig.jsPagesDir + '/*.js*', { matchBase:true });
    console.log('build %s page files', files.length);

    var streams = files
        .map(function(filePath) {
          var outputName = filePath.substr(filePath.lastIndexOf('/') + 1).replace('.jsx', '.js');
          return browserifyIt(filePath, outputName);
        });

    // Return a merged stream and fire a livereload once all of the individual files are built
    return merge(streams)
        .pipe(livereload());
  });

  /**
   * Builds each css file for each page in the less/pages dir.
   */
  gulp.task('build:page-css', function () {
    return gulp.src(buildConfig.lessBaseDir)
        .pipe(less({compress: true}))
        .on('error', function(err){
          console.error('error in css build: ' + err);
          this.emit('end');
        })
        .pipe(gulp.dest(buildConfig.lessDistDir))
        .on('end', function(){
          console.log('done build:page-css');
        });
  });

  gulp.task('dist:polymer-css', function(){
    return gulp.src(buildConfig.polymerLessDir)
        .pipe(less({compress: true}))
        .pipe(gulp.dest(buildConfig.lessDistDir));
  });

  /**
   * copies the built core.js from node_modules dir to appropriate webapp/js dir.
   */
  gulp.task('dist:core-js', function(){
    var coreFilePath = glob.sync(buildConfig.corejsSrcMatchPattern)[0];
    return gulp.src(coreFilePath).pipe(gulp.dest(buildConfig.corejsDistPath));
  });

  /**
   * copies the fonts dir to appropriate webapp/fonts dir.
   */
  gulp.task('dist:core-fonts', function(){
    return gulp.src(buildConfig.fontsBaseDir).pipe(gulp.dest(buildConfig.fontsDistDir));
  });

  /**
   * Copies html templates to a dist dir
   */
  gulp.task('dist:page-html-imports', function(){
    var streams = [
      gulp.src(buildConfig.htmlUiBaseDir).pipe(gulp.dest(buildConfig.htmlDistDir)),
      gulp.src(buildConfig.htmlBaseDir).pipe(gulp.dest(buildConfig.htmlDistDir))
    ];

    return merge(streams);
  });

  /**
   * Presently this will copy all the polymer and core-components files over simply
   * In the future it will use vulcanize too create one components artifact.
   */
  gulp.task('dist:polymerize', ['dist:polymer-css'], function() {
    var polymerDirs = [
      '/iron-*',
      '/paper-*',
      '/neon-*',
      '/google-*',
      '/platinum-*',
      '/sw-*',
      '/web-animations-*'
    ];

    var streams = [
      gulp.src(buildConfig.polymerBaseDir).pipe(gulp.dest(buildConfig.jsDistDir + '/polymer')),
      gulp.src(buildConfig.polymerPromiseDir).pipe(gulp.dest(buildConfig.jsDistDir + '/promise-polyfill')),
      gulp.src(buildConfig.vendorBaseDir + '/webcomponentsjs/webcomponents-lite.min.js').pipe(gulp.dest(buildConfig.jsDistDir + '/webcomponentsjs'))
    ];

    streams = streams.concat(
        polymerDirs.map(function (dir) {
          return gulp.src(buildConfig.vendorBaseDir + dir + '/**/*')
              .pipe(gulp.dest(buildConfig.jsDistDir));
        }));

    return merge(streams);
  });

  /**
   * copies the compiled core css from the /dist dir to the appropriate webapp/css dir.
   */
  gulp.task('dist:core-css', function() {
    return gulp.src(buildConfig.coreCssSrcMatchPattern).pipe(gulp.dest(buildConfig.coreCssDistPath));
  });

  /**
   * copies the images dir to appropriate webapp/fonts dir.
   */
  gulp.task('dist:core-images', function(){
    return gulp.src(buildConfig.imagesBaseDir).pipe(gulp.dest(buildConfig.imagesDistDir));
  });

  /**
   * copies the core components handlebars dir to appropriate webapp/templates dir.
   */
  gulp.task('dist:core-templates-handlebars', function(){
    return gulp.src(buildConfig.handlebarsTemplatesBaseDir).pipe(gulp.dest(buildConfig.handlebarsTemplatesDistDir));
  });

  /**
   * copies the core components handlebars dir to appropriate webapp/templates dir.
   */
  gulp.task('dist:page-templates-handlebars', function(){
    return gulp.src(buildConfig.handlebarsTemplatesPageDir).pipe(gulp.dest(buildConfig.handlebarsTemplatesPageDistDir));
  });

  /**
   * copies the core components JS dir to the webapp/js/components dir.
   */
  gulp.task('dist:components', function(){
    return gulp.src(buildConfig.jsComponentsDir).pipe(gulp.dest(buildConfig.jsComponentsDistDir));
  });

  /**
   * Runs unit tests using Mocha test runner
   * https://www.npmjs.com/package/gulp-mocha
   */
  gulp.task('test', function() {
    return gulp.src(buildConfig.jsTest.pattern, {read: false})
        .pipe(mocha(buildConfig.jsTest.config));
  });

  /**
   * Watch tasks so you don't have to manually build each time you change a file
   */
  gulp.task('watch', function(){
    livereload.listen();
    gulp.watch('src/**/*.less', ['build:page-css']);
    gulp.watch('src/**/*.js*', ['build:page-js']);
  });

  /**
   * Watch tasks that also run the JS unit tests after JS changes are detected
   */
  gulp.task('watch:test', function() {
    livereload.listen();
    gulp.watch('src/**/*.less', ['build:page-css']);
    gulp.watch(buildConfig.jsTest.pattern, function() {
      runSequence('test', 'build:page-js');
    });
  });

  return buildConfig;
};
