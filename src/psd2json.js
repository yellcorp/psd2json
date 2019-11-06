/*global
  $,
  ColorProfile,
  ExportOptionsSaveForWeb,
  Extension
  File,
  Folder,
  LayerKind,
  PNGSaveOptions,
  SaveOptions,
  app,
*/
"use strict";


var fileutil = require("./xslib/fileutil");
var namers = require("./lib/namers");
var psutil = require("./lib/psutil");
var snapshot = require("./lib/snapshot");
var interpretSaveOptions =
  require("./lib/saveoptions/interpret").interpretSaveOptions;


var GLYPH_TITLE_SEPARATOR = " \u2023 ";
var GLYPH_ENTER = "\u21B3 ";
var GLYPH_EXPORT = "\u2022 ";
var GLYPH_SKIP = "\u2205 ";
var GLYPH_OKLF = " \u2713\n";
var LOG_INDENT = "  ";

var DEFAULT_SAVE_OPTIONS = new PNGSaveOptions();
DEFAULT_SAVE_OPTIONS.compression = 4;
DEFAULT_SAVE_OPTIONS.interlaced = false;

var NAMER_LOOKUP = {
  counter:   namers.counterNamer,
  hash:      namers.hashNamer,
  layerPath: namers.layerPathNamer
};


function unitValueArrayAs(uvs, unitType) {
  var result = [ ];
  for (var i = 0; i < uvs.length; i++) {
    result.push(uvs[i].as(unitType));
  }
  return result;
}


function flattenedTrimmedCopy(doc, newDocumentName) {
  var flatDoc = doc.duplicate(newDocumentName, true);
  var bounds = flatDoc.layers[0].bounds;

  if (bounds[0] === bounds[2] || bounds[1] === bounds[3]) {
    flatDoc.close(SaveOptions.DONOTSAVECHANGES);
    flatDoc = null;
  } else {
    flatDoc.crop(bounds);
  }
  return [ flatDoc, bounds ];
}


function documentNameForLayer(layerSnapshot) {
  var name = "Flattened copy of " +
    layerSnapshot.document.name + GLYPH_TITLE_SEPARATOR +
    layerSnapshot.layerPath.join(GLYPH_TITLE_SEPARATOR);

  return name.replace(":", ";");
}


function saveLayerDoc(doc, inFolder, baseName, formatObject) {
  var saveOptions = interpretSaveOptions(formatObject, DEFAULT_SAVE_OPTIONS);
  var formatExtension = psutil.fileSuffixForSaveOptions(saveOptions);
  var file = new File(
    inFolder.absoluteURI + "/" +
    escape(baseName + formatExtension)
  );
  file.parent.create();
  app.activeDocument = doc;

  if (saveOptions instanceof ExportOptionsSaveForWeb) {
    psutil.saveForWeb(doc, file, saveOptions);
  } else {
    doc.saveAs(file, saveOptions, true, Extension.LOWERCASE);
  }
  doc.close(SaveOptions.DONOTSAVECHANGES);
  return file;
}


var SKIP = 0;
var EXPORT = 1;
var ENTER = 2;

function makeConstFunc(value) {
  return function () {
    return value;
  };
}

function coerceBooleanFunction(funcOrBool, defaultIfUndef) {
  if (funcOrBool == null) {
    return coerceBooleanFunction(defaultIfUndef, false);
  }
  if (typeof funcOrBool === "function") {
    return funcOrBool;
  }
  return makeConstFunc(Boolean(funcOrBool));
}

function log(text) {
  $.write(text);
}

function dontLog(_) {
  // no-op
}

/**
 * Exports a Photoshop document's layers as images + JSON metadata.
 *
 * @param {string|File|Document} doc - The document to export. If a String or
 *   File object is passed, it will be opened (or foregrounded if already
 *   open).
 * @param {string|File} outJsonFile - The path of the output JSON metadata.
 * @param {string|Folder} outLayerImageFolder - The root folder to contain
 *   layer image files.
 * @param {Object} options - Options controlling the export.
 * @param {Boolean} [options.flattenOpacity=true] - Whether to flatten layer
 *   opacity. If `true` (the default), layers will be exported at their current
 *   opacity. That is for example, a solid layer at 25% opacity will appear 25%
 *   opaque in a PNG file. If `false`, layers will have their opacity set to
 *   100% before exporting, and their original opacity will appear in the JSON
 *   file under an `opacity` property, in the range 0-1.
 * @param {Boolean} [options.exportTree=true] - Whether to reflect the
 *   structure of layer sets (layer folders) in the JSON file. If `true` (the
 *   default), layer sets will appear in the JSON file with a `set` key having
 *   the value `true`, and child layers/sets will appear in a `layers` array of
 *   its own. Note: setting this to `false` forces `flattenOpacity` to be
 *   `true`, as final opacity is dependent on not just a layer, but the opacity
 *   of its parent layer set(s).
 *   (TODO: could just output the product of the layer opac and its parents)
 * @param {Boolean} [options.verbose=false] - If `true`, log progress
 *   information to the Debug Console. The default is `false`.
 * @param {Boolean|EnterLayerSetCallback} [options.shouldEnterLayerSet=false] -
 *   A {@link EnterLayerSetCallback} that decides whether a layer set should
 *   have its contents exported individually. When a layer set is encountered,
 *   a {@link LayerSnapshot} of it is paassed to this callback, and its return
 *   value is used. If the callback returns `true`, its contents will be
 *   individually considered for export. If `false`, the layer set is treated
 *   like a flat layer. `true` or `false` can also be used here, which will be
 *   treated like a function that always returns that value for all layer sets.
 * @param {Boolean|ImageFormat|ExportLayerCallback}
 *   [options.shouldExportLayer=true] - A {@link ExportLayerCallback} that
 *   decides whether, and how, a layer should be saved to an image file. If the
 *   callback returns a falsy value, the layer is skipped - it will not be
 *   exported to an image and it won't appear in the JSON metadata. If the
 *   callback returns `true`, the layer will appear in the JSON metadata and be
 *   exported as a PNG with transparency (using the Save As dialog, rather than
 *   Save for Web). Other callback return values are interpreted as an
 *   {@link ImageFormat}. If a literal value is provided instead of a function,
 *   it will be treated as a function that returns that value regardless of
 *   layer.
 * @param {ExtraLayerDataCallback} [options.extraLayerData=null] - A callback
 *   which can add extra data to the layer's exported metadata. If provided, it
 *   is called for each exported layer and layer set, passing in a
 *   `LayerSnapshot`. Its return value appears in a `data` property among the
 *   layer's metadata.
 * @param {string} [options.fileNaming='hash'] - A string specifying the means
 *   of generating layer image filenames. The possible values are: `'hash'`,
 *   which generates a hexadecimal hash from each layer's name, `'counter'`,
 *   which uses a simple increasing counter, and `'layerPath'`, which uses the
 *   layer's name, prepended by the names of its parent layer sets if any. All
 *   generated filenames are appended with an extra number to guard against
 *   duplicate names.
 */
function exportDocument(doc, outJsonFile, outLayerImageFolder, options) {
  if (typeof doc === "string") {
    doc = new File(doc);
  }
  if (doc instanceof File) {
    doc = app.open(doc);
  }

  if (typeof outJsonFile === "string") {
    outJsonFile = new File(outJsonFile);
  }

  if (!outLayerImageFolder) {
    outLayerImageFolder = outJsonFile.parent;
  } else if (typeof outLayerImageFolder === "string") {
    outLayerImageFolder = new Folder(outLayerImageFolder);
  }

  if (!options) {
    options = { };
  }

  var outJsonBaseUri = outJsonFile.parent.absoluteURI;

  var optionFlattenOpacity = options.flattenOpacity !== false;
  var optionExportTree = options.tree !== false;
  var logFunc = options.verbose ? log : dontLog;
  var enterFolderCallback = coerceBooleanFunction(options.shouldEnterLayerSet, false);
  var exportLayerCallback = coerceBooleanFunction(options.shouldExportLayer, true);
  var extraLayerDataCallback = options.extraLayerData;

  var namerKey = options.fileNaming;
  var createNamer = NAMER_LOOKUP[namerKey] || NAMER_LOOKUP.hash;
  var generateName = createNamer();

  // because the opacity of a layer is the product of its opacity and all its
  // parent opacities, layer sets must be exported, because opacity information
  // is attached to them. if we are exporting a flat document, we lose that
  // information, and opacity must be flattened.
  //
  // TODO: actually just accumulate the opacity by keeping a running product,
  // or something like that
  if (!optionExportTree) {
    optionFlattenOpacity = true;
  }

  var outJson = {
    profile: (
        doc.colorProfileType === ColorProfile.CUSTOM ||
        doc.colorProfileType === ColorProfile.WORKING
      ) ? doc.colorProfileName : "",
    size: [ doc.width.as("px"), doc.height.as("px") ],
    layers: [ ],
    options: {
      flattenedOpacity: optionFlattenOpacity,
      tree: optionExportTree
    }
  };

  var stack = [ ];

  logFunc("Starting psd2json with document " + doc.name);
  var docSnapshot = new snapshot.DocumentSnapshot(doc).prepare();
  logFunc(GLYPH_OKLF);

  stack.push([ docSnapshot, outJson.layers, 0, "" ]);

  while (stack.length > 0) {
    var state = stack.pop();

    var containerSnapshot = state[0];
    var exportArray = state[1];
    var index = state[2];
    var logIndent = state[3];

    while (index < containerSnapshot.layers.length) {
      var layerSnapshot = containerSnapshot.layers[index];

      var action = SKIP;
      var exportCallbackResult = null;
      if (
        layerSnapshot.typename === "LayerSet" &&
        layerSnapshot.clippedLayers.length === 0 &&
        // TODO: !hasLayerEffects
        enterFolderCallback(layerSnapshot)
      ) {
        action = ENTER;
      } else {
        exportCallbackResult = exportLayerCallback(layerSnapshot);
        if (exportCallbackResult) {
          action = EXPORT;
        }
      }

      var exportLayer, clientData;
      // eslint-disable-next-line no-negated-condition
      if (action !== SKIP) {
        layerSnapshot.setLiveVisible(true);
        if (layerSnapshot.anyLocked) {
          layerSnapshot.live.allLocked = false;
        }

        exportLayer = {
          name: layerSnapshot.name,
          layerPath: layerSnapshot.layerPath.slice(),
          indexPath: layerSnapshot.indexPath.slice(),
          index: layerSnapshot.index,
          mode: psutil.enumName(layerSnapshot.blendMode)
        };
        exportArray.unshift(exportLayer);

        if (extraLayerDataCallback) {
          clientData = extraLayerDataCallback(layerSnapshot);
        }

        if (typeof clientData !== "undefined") {
          exportLayer.data = clientData;
        }

        if (!optionFlattenOpacity) {
          exportLayer.opacity = layerSnapshot.opacity / 100;
          if (layerSnapshot.opacity !== 100) {
            layerSnapshot.live.opacity = 100;
          }
        }
      } else {
        logFunc(logIndent + GLYPH_SKIP + layerSnapshot.name + "\n");
      }

      if (action === ENTER) {
        logFunc(logIndent + GLYPH_ENTER + layerSnapshot.name);

        stack.push([ containerSnapshot, exportArray, index + 1, logIndent ]);

        if (optionExportTree) {
          exportLayer.set = true;
          exportLayer.layers = [ ];
          exportArray = exportLayer.layers;
        } else {
          exportArray.shift();
        }

        containerSnapshot = layerSnapshot.prepare();
        logIndent += LOG_INDENT;
        index = -1; // incremented to 0 at end of loop

        logFunc(GLYPH_OKLF);
      } else if (action === EXPORT) {
        logFunc(logIndent + GLYPH_EXPORT + layerSnapshot.name);

        if (layerSnapshot.typename === "ArtLayer") {
          if (!optionFlattenOpacity) {
            exportLayer.fillOpacity = layerSnapshot.fillOpacity / 100;
            if (layerSnapshot.fillOpacity !== 100) {
              layerSnapshot.live.fillOpacity = 100;
            }
          }

          if (layerSnapshot.kind === LayerKind.TEXT) {
            // TODO: textItem has a ton of other properties you could export
            exportLayer.text = layerSnapshot.textItem.contents;
          }
        }

        var copyBounds = flattenedTrimmedCopy(
          doc,
          documentNameForLayer(layerSnapshot)
        );

        var layerDoc = copyBounds[0];
        if (layerDoc) {
          var savedFile = saveLayerDoc(
            layerDoc,
            outLayerImageFolder,
            generateName(layerSnapshot),
            exportCallbackResult
          );
          app.activeDocument = doc;
          exportLayer.path = unescape(savedFile.getRelativeURI(outJsonBaseUri));
        } else {
          exportLayer.empty = true;
        }
        exportLayer.bounds = unitValueArrayAs(copyBounds[1], "px");
        layerSnapshot.setLiveVisible(false);

        logFunc(GLYPH_OKLF);
      }
      index++;
    }
    containerSnapshot.setLiveVisible(false);
  }

  outJsonFile.parent.create();
  fileutil.writeJson(outJsonFile, outJson, { space: " " });

  return 0;
}


/**
 * Decides whether a layer set should have its contents individually exported.
 *
 * @callback EnterLayerSetCallback
 * @param {LayerSnapshot} - A snapshot of the layer set under consideration.
 * @returns {Boolean} `true` to export contents, `false` to treat as a flat
 *   layer.
 */

/**
 * Decides whether to export a layer to an image, and if so, the file format
 * used.
 *
 * @callback ExportLayerCallback
 * @param {LayerSnapshot} - A snapshot of the layer set under consideration.
 * @returns {Boolean|ImageFormat} The format to export to. If `true`, default
 *   export settings are used. If `false`, `null`, or `undefined`, the layer is
 *   skipped.
 */

/**
 * Associates extra data with a layer's metadata.
 *
 * @callback ExtraLayerDataCallback
 * @param {LayerSnapshot} - A snapshot of the layer set under consideration.
 * @returns {*} A JSON-compatible value that will appear in the layer
 *   metadata's `data` property.
 */

/**
 * Specifies a file format.
 *
 * This type actually encompasses a large number of possible values:
 *
 * * A `string`, which can be one of `bmp`, `gif`, `jpeg`, `jpg`, `png`,
 *   `targa`, `tif`, or `tiff`, which selects a file format with appropriate
 *   default settings for that format.
 *
 * * An instance of one of Photoshop's own options classes
 *   * Save As classes:
 *     - JPEGSaveOptions
 *     - PNGSaveOptions
 *     - BMPSaveOptions
 *     - GIFSaveOptions
 *     - TargaSaveOptions
 *     - TiffSaveOptions
 *   * Save for Web classes:
 *     - ExportOptionsSaveForWeb
 *
 * * An object literal, which allows for simpler, more concise inline option
 *   expression without having to construct a new options instance and assign
 *   properties. Property names are the same as their corresponding Photoshop
 *   classes, with the following differences:
 *     - A `format` property must be present, set to one of the values listed
 *       above for string values.
 *     - For formats supported by Save for Web (`gif`, `jpeg` and `png`), a
 *       `web` property set to `true` will export the layer via Save for Web as
 *       opposed to Save As.
 *     - Enums can be expressed as strings, instead of `EnumClass.VALUE`. For
 *       example, the `colorReduction` property for `gif` can be written
 *       `"selective"` instead of `ColorReductionType.SELECTIVE`, although the
 *       latter is still understood. Strings are interpreted
 *       case-insensitively.
 *     - JPEG quality is always on the scale 0 - 100. This includes the
 *       `jpegQuality` field for `tiff`. If Save As is used rather than Save
 *       for Web, it is automatically scaled to the 0 - 12 range used by
 *       Photoshop.
 *
 * @typedef {(Object|string)} ImageFormat
 */


module.exports = {
  exportDocument: exportDocument
};
