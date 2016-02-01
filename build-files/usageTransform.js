var through = require("through2");

/**
 * Allows us to simply wrap //usage comments around a react element so that the html encoded value can be displayed along side the actual usage.
 * e.g.
 * //usage
 * <Header message="testing" />
 * //usage
 *
 * would get transformed into
 * <Header message="testing" />
 * <div className="usage">{'<Header message="testing" />'}</div>
 *
 * the usage comments are removed and the usage div is injected below the actual usage.
 *
 * @param file
 * @returns {*}
 */
var mod = function (file) {
    return through(function (buf, enc, next) {
        var str = buf.toString('utf8');
        //console.log('buf==============:\n\n' + str);
        var usage = '//usage';
        // you'll end up with an array like ["", "<Header message='whatever' />, ""];
        var usages = str.split(usage);
        if(usages){
            var count = 0;
            usages.forEach(function(aUsageExample){
                if(count++ % 2 != 0){
                    var replacementVal = buildUsageString(aUsageExample);
                    str = str.replace(usage, replacementVal);
                }else{
                    str = str.replace(usage, ''); //cut out the closing usage tag.
                }
            });
        }

        //console.log('final str:\n' + str);
        this.push(str);
        next();
    });
};

function buildUsageString(usage){
    usage = usage.trim();
    var str = '<div className="usage">{' + "'" +usage + "'}</div>";
    return str;
}

    //var mod = function (file) {
    //    return through(function (buf, enc, next) {
    //        var str = buf.toString('utf8');
    //        console.log('buf==============:\n\n' + str);
    //        var usage = '//usage';
    //        var usageStartIndex = -1,
    //            usageEndIndex = -1;
    //        while(usageStartIndex = str.indexOf(usage) >= 0){
    //            console.log('usageStartIndex: ' + usageStartIndex);
    //            var
    //                }
    //
    //            this.push(str);
    //            next();
    //        });
    //    };
module.exports = mod;