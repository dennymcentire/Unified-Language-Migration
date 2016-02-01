var gulp = require('gulp');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var transform = require('vinyl-transform');
var glob = require("glob");
var through = require("through2");
var browserUnpack = require("browser-unpack");
var fs = require('fs');
var del = require('del');
var _ = require('underscore');
var uglify = require('gulp-uglify');
var gutil = require('gulp-util');
var gStreamify = require('gulp-streamify');//needed because gulp-uglify doesn't support streaming.
var less = require('gulp-less');
var path = require('path');
var jshint = require('jshint').JSHINT;
var gulpjshint = require('gulp-jshint');
var stylish = require('jshint-stylish');
var jshintReporter = stylish.reporter;
var exec = require('child_process').exec;
var usageTransform = require('./build-files/usageTransform');
var minimatch = require('minimatch');
var runSequence = require('run-sequence').use(gulp);
var rename = require('gulp-rename');
var mocha = require('gulp-mocha');
var karmaFactory = require('./build-files/karma-factory');
var projectBuild = require('./build-files/projectBuild');
var wctTest = require('web-component-tester').test;

var vendorBaseDir = 'js/vendor'
var targetDir = 'target';

function joinTargetDir(dir) {
    return targetDir + '/' + dir;
};

function joinVendorDir(dir) {
    return vendorBaseDir + '/' + dir;
};

function runWCTTasks(additionalTask) {
  var wctBuildTasks = [
    'dist:polymerize',
    'dist:core-fonts',
    'dist:page-html-imports'
  ];

  if (additionalTask) {
    wctBuildTasks.push(additionalTask);
  }

  return wctBuildTasks;
}

projectBuild(gulp, {
    vendorBaseDir: vendorBaseDir,
    polymerBaseDir: joinVendorDir('/polymer/**/*'),
    polymerPromiseDir: joinVendorDir('/promise-polyfill/**/*'),
    polymerLessDir: 'less/components/polymer/*.less',
    htmlBaseDir: 'polymer/**/*.html',
    fontsBaseDir: 'fonts/**/*',
    fontsDistDir: joinTargetDir('fonts'),
    jsDistDir: joinTargetDir('js'),
    lessDistDir: joinTargetDir('css'),
    htmlDistDir: joinTargetDir('html')
});

var Q = require('q');

var buildConfig = require('./build-files/buildConfig').config;
var mixinCommonBrowserifyConfig = require('./build-files/buildConfig').mixinCommonBrowserifyConfig;
var commonBrowserifyConfig = require('./build-files/buildConfig').commonBrowserifyConfig;


require('web-component-tester').gulp.init(gulp);

/**
 * Generates a core-vX.X.X.js file into the release folder.
 * Creates a new git tag representing the version number.
 * Make sure you have done a gulp build first, so that there is a dist/core.js file.
 * Will push to git with --tags option
 */
gulp.task('release', function (cb) {
    var packageJson = require('./package.json');
    console.log(packageJson.version);
    var versions = packageJson.version.split('.');
    var major = parseInt(versions[0]);
    var minor = parseInt(versions[1]);
    var patch = parseInt(versions[2]);
    console.log('major: %s minor: %s patch: %s', major, minor, patch);
    ++patch;
    var newVersion = major + "." + minor + "." + patch;

    var newCoreFileName =  'core.js';//'core-v'+ newVersion+'.js';
    //first make sure there are no modifications. this is needed by npm version patch command ultimately, but we will be committing as well, so it's needed to make sure we only commit what's supposed to be committed.

    function deletePreExistingReleaseFiles(){
        var deferred = Q.defer();
        glob('./release/*.js', function(er, files){
            if(er){
                console.error('error deleting files from release dir')
                deferred.reject(er);
            }else{
                for(var i =0; i< files.length; ++i){
                    var file = files[i];
                    console.log('deleting file: ' + file);
                    fs.unlinkSync(file);
                }
                deferred.resolve();
            }

        });

        return deferred.promise;
    }

    function generateReleaseFile(){
        console.log('generateReleaseFile...');
        var deferred = Q.defer();
        gulp.src('./dist/core.js')
            .pipe(rename(newCoreFileName))
            .pipe(gulp.dest('./release'))
            .on('end', function(){
                console.log('done generating core release file');
                deferred.resolve();
            }).on('error', function(err){
                console.error('unable to release into ./release folder.Make sure you have a core.js in your dist folder (run gulp build)');
                deferred.reject(err);
            });
        return deferred.promise;
    }

    /**
     * NPM Version Patch will not work if git has pending modifications
     * @param cb
     */
    function checkIfDirty(){
        console.log('checkIfDirty...');
        var deferred = Q.defer();
        exec('git status -s', function(err, stdout, stderr){
            var isDirty = stdout.indexOf(" M ") >= 0;
            if(isDirty){
                console.error('commit all files first');
                deferred.reject('commit all files first');
            }else{
                deferred.resolve();
            }
        });
        return deferred.promise;
    }

    function gitAddGeneratedCoreFile(){
        console.log('gitAddGeneratedCoreFile...');
        var deferred = Q.defer();
        exec("git add release/" +  newCoreFileName, function(err, stdout, stderr){
            console.log('stderr: ' + stderr);
            if(stderr){
                deferred.reject(stderr);
            }else{
                deferred.resolve();
            }
        });
        return deferred.promise;
    }
    function commitReleasedCoreFile(){
        console.log('commitReleasedCoreFile...');
        var deferred = Q.defer();
        exec("git commit -am 'releasing core file: " +  newCoreFileName + "' ", function(err, stdout, stderr){
            console.log('stderr: ' + stderr);
            if(stderr){
                deferred.reject(stderr);
            }else{
                deferred.resolve();
            }
        });
        return deferred.promise;
    }


    function npmVersionPatch(){
        console.log('npmVersionPatch...');
        var deferred = Q.defer();
        exec('npm version patch', function (err, stdout, stderr) {
            if(stderr){
                console.error('npm version patch failed: ' + stderr);
                deferred.reject(stderr);
            }else{
                deferred.resolve();
            }
        });
        return deferred.promise;
    }

    function gitPushWithTags(){
        console.log('gitPushWithTags...');
        var deferred = Q.defer();
        exec('git push --tags', function (err, stdout, stderr) {
            deferred.resolve();
        });
        return deferred.promise;
    }


    Q.fcall(buildCore)
        .then(checkIfDirty)
        .then(deletePreExistingReleaseFiles)
        .then(generateReleaseFile)
        .then(gitAddGeneratedCoreFile)
        .then(commitReleasedCoreFile)
        .then(npmVersionPatch)
        .then(gitPushWithTags)
        .then(function(){
            console.log('done with release build!');
            cb();
        })
        .catch(function(err){
            console.error('ERROR: ' + err);
            cb(err);
        });

});

/**
 * Clean everything
 */
gulp.task('clean', function(cb) {
    del([
        buildConfig.jsDistDir,
        buildConfig.lessDistDir
    ], cb);
});


/**
 * Build everything
 */
gulp.task('build', ['build:core', 'build:core-css', 'build:components-css']);

/**
 * Builds core.js to the dist dir.
 * core.js includes all modules defined in the js/core dir, as well as third party libs like jquery and backbone.
 *
 * https://github.com/substack/browserify-handbook
 *
 * TODO: jshint, remove console.log.
 */
function buildCore(){
    var idAlias={};
    idAlias[path.normalize(__dirname + "/js/vendor/jquery/dist/jquery.min.js")] = "jquery";
    idAlias[path.normalize(__dirname + "/js/vendor/backbone/backbone.js")] = "backbone";
    idAlias[path.normalize(__dirname + "/js/vendor/handlebars/handlebars.min.js")] = "handlebars";
    idAlias[path.normalize(__dirname + "/js/vendor/underscore/underscore-min.js")] = "underscore";
    //console.log(idAlias);
    /**
     * We want to expose our core modules so they can be referenced via 'core/modulename' instead of './js/core/modulename'
     * We also want to alias some of the third party libs, and expose them so they can be referenced via 'jquery', 'react', etc.
     */
    var labeler = through.obj(function (module, enc, next) {
        //console.log('module id: ' + module.id);
        //expose id as 'react' rather than 'nodemodules/react/react.js'
        if(idAlias[module.id]){
            module.id = idAlias[module.id];
            console.log('exposing new id: ' + module.id);
        }

        //iterate over each dependency of the module
        Object.keys(module.deps).forEach(function (key) {
            //console.log('dep: %s key: %s', module.deps[key], key);
            //expose core by 'core/X' rather than './js/core/X'
            if(key.indexOf('core/') >= 0) //only expose/tinker with core
                module.deps[key] = key;

            //if there's a dep on something we've aliased, point to the alias.
            //e.g. instead of 'react':'some/really/long/path/react.js' do 'react':'react'
            if(idAlias[module.deps[key]]){
                //console.log('pointing to alias for key:' + key);
                module.deps[key] = key;
            }
        });

        this.push(module);
        next();
    });

    //jshint files
    var linter = through.obj(function (row, enc, next) {
        //console.log('row id : ' + row.id);
        var shouldHint = false;

        for(var i =0; i < buildConfig.jshintThese.length; ++i){
            var pattern = buildConfig.jshintThese[i];
            shouldHint = minimatch(row.id, pattern);
            if(shouldHint){
                console.log('we should lint: ' + row.id);
                break;
            }
        }
        if(shouldHint){
            var pass = jshint(row.source, buildConfig.jshint);
            var results = [];
            if(!pass){
                jshint.errors.forEach(function (err) {
                    if (err) {
                        results.push({ file: row.file || row.id|| "stdin", error: err });
                    }
                });
            }

            jshintReporter.reporter(results);
        }


        //todo: break the build??
        this.push(row);
        next();
    });

    /**
     * we want to include everything thats in the core folder, so gather all the filenames, and dont include extensions because it messes up module ids.
     */
    function getCoreFilePaths(){
        var files =glob.sync("core/**/*.js", {
            realpath: true,
            cwd: buildConfig.jsBaseDir //we don't want the returned paths to contain 'Users/jason.mcaffee/...' at the beginning, so start in the core dir.
        });
        return files;
    }

    //mixin some of the common transforms, paths, etc.
    var browserifyConfig = mixinCommonBrowserifyConfig({
        entries:[].concat(getCoreFilePaths())
    });
    //console.log('build:core browserify config: %s', JSON.stringify(browserifyConfig, null, 2));

    var bundler = browserify(browserifyConfig);
    bundler.pipeline.get('label').splice(0, 1, labeler);//rename module ids
    bundler.pipeline.get('syntax').push(linter);

    //require any third party libraries.
    bundler.require('./js/vendor/jquery/dist/jquery.min.js', {expose:'jquery'}); //expose is how the modules require it. e.g. require('jquery');
    bundler.require('./js/vendor/backbone/backbone.js', {expose:'backbone'});
    bundler.require('./js/vendor/underscore/underscore-min.js', {expose:'underscore'});
    bundler.require('./js/vendor/handlebars/handlebars.min.js', {expose:'handlebars'});


    var deferred = Q.defer();

    bundler.bundle()
        // .pipe(linter)
        .pipe(source('core.js'))//the generated file name
        .pipe(gStreamify(uglify(buildConfig.uglify)))
        .pipe(gulp.dest(buildConfig.jsDistDir))
        .on('error', function(){
            deferred.reject('error building core');
        }).on('end', function(){
            deferred.resolve();
        });//where to put the generated file name
    return deferred.promise;
}
gulp.task('build:core', buildCore);


/**
 * Builds the sample application app, which demonstrates how to use core components.
 * Ensures that all modules packed in core.js are marked as external/not included in app bundle.
 */
function buildUIComponentsApp(){

    //unpack the bundled core.js to grab all the row/module ids so we can flag them as external and not include them in the app bundle.
    //not actually needed for this build, but sets the example for other app builds.
    //var src = fs.readFileSync(__dirname + '/dist/core.js', 'utf8');
    //var coreBundleRows = browserUnpack(src);
    ////console.log('bundled rows: ' + JSON.stringify(coreBundleRows.length));
    //var coreBundleModuleIds = _.pluck(coreBundleRows, 'id');
    //
    ////console.log(JSON.stringify(coreBundleModuleIds));
    //var browserifyConfig = mixinCommonBrowserifyConfig({
    //    transform: [usageTransform].concat(commonBrowserifyConfig.transform)
    //});
    //console.log("transform: ", [usageTransform].concat(commonBrowserifyConfig.transform))
    //console.log('build:ui-components-app browserify config: %s', JSON.stringify(browserifyConfig, null, 2));
    //
    //var bundler = browserify(browserifyConfig)
    //    .external(coreBundleModuleIds);
    //
    //return bundler.bundle()
    //    .pipe(source('ui-components-app.js'))
    //    .pipe(gulp.dest(buildConfig.jsDistDir));

}
//gulp.task("build:ui-components-app", buildUIComponentsApp);

gulp.task('build:core-css', function () {
    return gulp.src(buildConfig.lessBaseDir + '/*(core|error-page).less')//'./less/**/*.less'
        .pipe(less({
            paths: [ path.join(__dirname, 'less', 'includes') ],
            compress: true
        }).on('error', gutil.log))
        .pipe(gulp.dest(buildConfig.lessDistDir));
});

gulp.task('build:components-css', function () {
    return gulp.src(buildConfig.lessBaseDir + '/components.less')//'./less/**/*.less'
        .pipe(less({
            paths: [ path.join(__dirname, 'less', 'includes') ],
            compress: true
        }).on('error', gutil.log))
        .pipe(gulp.dest(buildConfig.lessDistDir));
});

gulp.task('build:pattern-library-css', function () {
    return gulp.src(buildConfig.lessBaseDir + '/pattern-library-test.less')//'./less/**/*.less'
        .pipe(less({
            paths: [ path.join(__dirname, 'less', 'includes') ]
        }).on('error', gutil.log))
        .pipe(gulp.dest(buildConfig.lessDistDir));
});


/**
 * Watch tasks so you don't have to manually build each time you change a file
 */
gulp.task('watch:js', function() {
    gulp.watch(buildConfig.jsBaseDir + '/**/*.js*', ['build:core-and-ui-components-app']);
});

gulp.task('watch:less', function() {
    gulp.watch(buildConfig.lessBaseDir + '/**/*.less', ['build:core-css', 'build:pattern-library-css', 'build:components-css']);
});


//gulp.task("jshint", function(){
//    return gulp.src([buildConfig.jsBaseDir + '/**/*.js*'])
//        .pipe(jshint(buildConfig.jshint))
//        .pipe(jshint.reporter(stylish));
//});

/**
 * Test task to execute the JS Tests
 */
gulp.task('test', [
  'test:karma:single',
  'test:mocha:single',
  'test:wct:single'
]);

gulp.task('test:remote', [
  'test:karma:single',
  'test:mocha:single',
  'test:wct:remote'
]);

gulp.task('test:watch', [
    'test:karma:watch',
    'test:mocha:watch',
    'test:wct:watch'
]);

gulp.task('test:karma:single', function(done) {
    return karmaFactory.create('ci', done);
});

gulp.task('test:karma:watch', function(done) {
    return karmaFactory.create('tdd', done);
});

gulp.task('test:mocha:single', function() {
    return gulp.src('node-tests/**/*.spec.js', {read: false})
      .pipe(mocha({
          reporter: 'tap'
      }));
});

gulp.task('test:mocha:watch', function() {
    gulp.watch(['build-files/**', 'node-tests/**'], ['test:mocha:single']);
});

gulp.task('test:wct:remote', runWCTTasks(), function(done) {
    var config = require('./build-files/wct.remote.conf');
    wctTest(config, function(error) {
        if (error) {
            throw error
        }

        done(error);
    });
});

gulp.task('test:wct:watch', runWCTTasks('test:local'));

gulp.task('test:wct:single', runWCTTasks(), function(done) {
    wctTest({
      persistent: false
    }, function(error) {
        if (error) {
            throw error
        }

        done(error);
    });
});

gulp.task('default', function(cb) {
    runSequence(
      'clean',
      'test',
      'build',
      cb);
});

gulp.task('build:remote', function(cb) {
    runSequence(
      'clean',
      'test:remote',
      'build',
      cb);
});
