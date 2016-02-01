var _ = require("underscore");
var deamdify = require("deamdify");

/**
 * generates the build configuration
 *
 * browserify config https://github.com/substack/node-browserify#var-b--browserifyfiles-or-opts
 *
 */
function generateBuildConfig(){
    var jsBaseDir = './js';
    var lessBaseDir = './less';
    var fontsBaseDir=  './fonts';

    var buildConfig = {
        jsBaseDir: jsBaseDir,
        fontsBaseDir: fontsBaseDir,
        fontsDestDir:  './dist',
        jsDistDir: './dist',
        lessDistDir: './dist',
        lessBaseDir: lessBaseDir,
        //tell browserify to scan the js directory so we don't have to use relative paths when referencing modules (e.g. no ../components).
        paths:['./js'],
        //assume these extensions for require statements so we don't have to include in requires e.g. components/header vs components/header.jsx
        extensions:['.js'],

        //http://jshint.com/docs/options/
        jshintThese:[
            "core/**/*"
        ],
        jshint:{
            curly: true,
            strict: true,
            browserify: true
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


    return buildConfig;
}

var buildConfig = generateBuildConfig();
//console.log('generated build config: ' + JSON.stringify(buildConfig, null, 4));

var commonBrowserifyConfig = {
    //tell browserify to scan the js directory so we don't have to use relative paths when referencing modules (e.g. no ../components).
    paths:buildConfig.paths,
    //tell browserify to scan the js directory so we don't have to use relative paths when referencing modules (e.g. no ../components).
    extensions:buildConfig.extensions,
    //convert amd defines to commonjs defines
    transform: [deamdify]
};

module.exports = {
    config: buildConfig,
    commonBrowserifyConfig: commonBrowserifyConfig,
    /**
     * convenience function so we don't have to keep defining paths, transforms, etc.
     * @param browserifyConfig
     * @returns {*}
     */
    mixinCommonBrowserifyConfig:function(browserifyConfig){
        return _.extend({}, commonBrowserifyConfig, browserifyConfig);
    }
};