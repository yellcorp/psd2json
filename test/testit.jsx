//@target photoshop
(function () {
//@include "../node_modules/@yellcorp/extendscript-commonjs/commonjs.js"
require.init($.fileName);
var testit = require("./testit.js");
testit.main();
}());
