/*global
  $,
  File
*/
"use strict";


var psd2json = require("../src/psd2json.js");

function main() {
  var scriptBase = new File($.fileName).parent;
  return psd2json.exportDocument(
    scriptBase + "/testdocument.psd",
    scriptBase + "/output/testdocument.json",
    null,
    {
      flattenOpacity: true,
      tree: true,
      outsideBounds: true,
      shouldEnterLayerSet: true,
      //shouldExportLayer: true,
      shouldExportLayer: function (layerSnapshot) {
        if (/must not be export/i.test(layerSnapshot.name)) {
          return false;
        }

        return {
          format: "gif",
          web: true,
          dither: "pattern",
          transparencyDither: "pattern",
        };
      },
      extraLayerData: function (layerSnapshot) {
        return {
          demonstratesUseOfLayerSnapshotData: layerSnapshot.layerPath.join("??"),
          aRandomNumber: Math.random()
        };
      },
      fileNaming: "layerPath",
      verbose: true
    }
  );
}

exports.main = main;
