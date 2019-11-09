/*global
  $,
  ColorProfile,
  ExportOptionsSaveForWeb,
  Extension,
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


var NAMING_STRATEGY_LOOKUP = {
  counter:   namers.counterNamer,
  hash:      namers.hashNamer,
  layerPath: namers.layerPathNamer
};

var DEFAULT_NAMING_STRATEGY = namers.hashNamer;


function unitValueArrayAs(unitValues, unitType) {
  var result = [ ];
  for (var i = 0; i < unitValues.length; i++) {
    result.push(unitValues[i].as(unitType));
  }
  return result;
}


function revealAll(doc) {
  doc.selection.selectAll();
  var originalBounds = unitValueArrayAs(doc.selection.bounds, "px");
  doc.revealAll();
  var newBounds = unitValueArrayAs(doc.selection.bounds, "px");
  doc.selection.deselect();

  return [
    originalBounds[0] - newBounds[0],
    originalBounds[1] - newBounds[1]
  ];
}


function translateNumericBounds(boundsValues, delta) {
  return [
    boundsValues[0] + delta[0],
    boundsValues[1] + delta[1],
    boundsValues[2] + delta[0],
    boundsValues[3] + delta[1]
  ];
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

  return {
    document: flatDoc,
    bounds: bounds
  };
}


function documentNameForLayer(layerSnapshot) {
  var name = "Flattened copy of " +
    layerSnapshot.document.name + GLYPH_TITLE_SEPARATOR +
    layerSnapshot.layerPath.join(GLYPH_TITLE_SEPARATOR);

  return name.replace(":", ";");
}


function saveLayerDoc(doc, inFolder, baseName, saveOptions) {
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


function serializeDocumentProfile(document) {
  if (
    document.colorProfileType === ColorProfile.CUSTOM ||
    document.colorProfileType === ColorProfile.WORKING
  ) {
    return document.colorProfileName;
  }
  return "";
}


function initJsonDocument(document) {
  return {
    profile: serializeDocumentProfile(document),
    name: document.name,
    size: unitValueArrayAs([ document.width, document.height ], "px"),
    layers: [ ]
  };
}


function isTraversableLayerSet(layerSnapshot) {
  // TODO: there was an old comment reading '!hasLayerEffects'. The reasoning
  // must be that if a folder having layer effects isn't flattened, there's no
  // way to preserve the appearance of those effects, as they're not backed by
  // an art layer. A quick glance shows no mention of layer effects in
  // snapshot.js, so that must be blocking it. Probably an ActionManager thing
  // if the API reference doesn't mention it.
  return (
    layerSnapshot.isLayerSet &&
    layerSnapshot.clippedLayers.length === 0
  );
}


function showAndUnlockLayer(layerSnapshot) {
  layerSnapshot.setLiveVisible(true);
  if (layerSnapshot.anyLocked) {
    layerSnapshot.live.allLocked = false;
  }
}


function serializeLayerCommon(layerSnapshot, out) {
  out.name = layerSnapshot.name;
  out.layerPath = layerSnapshot.layerPath.slice();
  out.indexPath = layerSnapshot.indexPath.slice();
  out.index = layerSnapshot.index;
  out.mode = psutil.enumName(layerSnapshot.blendMode);
}


function attachExtraLayerData(dataFunction, layerSnapshot, out) {
  if (dataFunction) {
    var extraData = dataFunction(layerSnapshot);
    if (typeof extraData !== "undefined") {
      out.data = extraData;
    }
  }
}


function serializeLayerText(layerSnapshot, out) {
  // TODO: textItem has a ton of other properties you could export
  out.text = layerSnapshot.textItem.contents;
}


function makeFullyOpaque(layerSnapshot) {
  if (layerSnapshot.opacity < 100) {
    layerSnapshot.live.opacity = 100;
  }

  if (layerSnapshot.isArtLayer && layerSnapshot.fillOpacity < 100) {
    layerSnapshot.live.fillOpacity = 100;
  }
}


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


function call(func, arg) {
  return func ? func(arg) : undefined;
}


var SKIP = "skip";
var EXPORT = "export";
var ENTER = "enter";

function Exporter() {
  // inputs
  this.document = null;
  this.outJsonFile = null;
  this.outLayerImageFolder = null;
  this.flattenOpacity = true;
  this.tree = true;
  this.outsideBounds = false;
  this.logFunction = null;
  this.shouldEnterLayerSetFunc = null;
  this.shouldExportLayerFunc = null;
  this.extraLayerDataFunc = null;
  this.generateName = null;

  // derived operation-wide
  this.globalBoundsTranslation = null;
}
(function (proto) {
  proto.run = function () {
    app.activeDocument = this.document;
    this.log("Starting psd2json with document " + this.document.name);

    var outJson = initJsonDocument(this.document);
    outJson.options = this.serializeExportOptions();

    this.globalBoundsTranslation = this.outsideBounds ?
      revealAll(this.document) :
      [ 0, 0 ];

    var documentSnapshot = new snapshot.DocumentSnapshot(this.document);
    this.traverseContainer(documentSnapshot, outJson.layers, "", 100);

    this.outJsonFile.parent.create();
    fileutil.writeJson(this.outJsonFile, outJson, { space: " " });

    this.log("Completed psd2json with document " + this.document.name + "\n");

    return 0;
  };

  proto.serializeExportOptions = function () {
    return {
      flattenOpacity: this.flattenOpacity,
      tree: this.tree,
      outsideBounds: this.outsideBounds
    };
  };

  proto.traverseContainer = function (containerSnapshot, exportArray, logIndent, cumulativeOpacity) {
    containerSnapshot.prepare();
    this.log(GLYPH_OKLF);

    for (var index = 0; index < containerSnapshot.layers.length; index++) {
      var layerSnapshot = containerSnapshot.layers[index];
      this.processLayer(layerSnapshot, exportArray, logIndent, cumulativeOpacity);
    }

    containerSnapshot.setLiveVisible(false);
  };

  proto.processLayer = function (layerSnapshot, exportArray, logIndent, cumulativeOpacity) {
    var intent = this.decideIntentForLayer(layerSnapshot);

    if (intent.action === SKIP) {
      this.log(logIndent + GLYPH_SKIP + layerSnapshot.name + "\n");
      return;
    }

    var exportLayer = { };

    showAndUnlockLayer(layerSnapshot);
    serializeLayerCommon(layerSnapshot, exportLayer);
    attachExtraLayerData(this.extraLayerDataFunc, layerSnapshot, exportLayer);

    if (!this.flattenOpacity) {
      exportLayer.opacity = this.tree ?
        layerSnapshot.opacity :
        (layerSnapshot.opacity * cumulativeOpacity / 100);

      if (layerSnapshot.isArtLayer) {
        exportLayer.fillOpacity = layerSnapshot.fillOpacity;
      }

      makeFullyOpaque(layerSnapshot);
    }

    switch (intent.action) {
      case ENTER:
        this.log(logIndent + GLYPH_ENTER + layerSnapshot.name);

        if (this.tree) {
          exportArray.unshift(exportLayer);
          exportLayer.set = true;
          exportLayer.layers = [ ];
        }
        // if tree is false, DON'T unshift the exportLayer, just let it
        // disappear

        this.traverseContainer(
          layerSnapshot,
          this.tree ? exportLayer.layers : exportArray,
          logIndent + LOG_INDENT,
          cumulativeOpacity * layerSnapshot.opacity / 100
        );
        break;

      case EXPORT:
        this.log(logIndent + GLYPH_EXPORT + layerSnapshot.name);

        exportArray.unshift(exportLayer);
        this.exportLayer(layerSnapshot, exportLayer, intent.imageSaveOptions);
        layerSnapshot.setLiveVisible(false);

        this.log(GLYPH_OKLF);
        break;

      default:
        throw new Error("Assert: bad action " + intent.action);
    }
  };

  proto.decideIntentForLayer = function (layerSnapshot) {
    if (
      isTraversableLayerSet(layerSnapshot) &&
      this.shouldEnterLayerSet(layerSnapshot)
    ) {
      return { action: ENTER };
    }

    var imageSaveOptions = this.shouldExportLayer(layerSnapshot);
    if (imageSaveOptions) {
      return {
        action: EXPORT,
        imageSaveOptions: imageSaveOptions
      };
    }

    return { action: SKIP };
  };

  proto.exportLayer = function (layerSnapshot, exportLayer, imageSaveOptions) {
    if (
      layerSnapshot.isArtLayer &&
      layerSnapshot.kind === LayerKind.TEXT
    ) {
      serializeLayerText(layerSnapshot, exportLayer);
    }

    var isolatedLayer = flattenedTrimmedCopy(
      this.document,
      documentNameForLayer(layerSnapshot)
    );

    exportLayer.empty = !isolatedLayer.document;
    if (exportLayer.empty) {
      exportLayer.path = null;
      exportLayer.bounds = [ 0, 0, 0, 0 ];
      return;
    }

    var filename = call(this.generateName, layerSnapshot);
    var nativeSaveOptions = interpretSaveOptions(
      imageSaveOptions,
      DEFAULT_SAVE_OPTIONS
    );

    var savedFile = saveLayerDoc(
      isolatedLayer.document,
      this.outLayerImageFolder,
      filename,
      nativeSaveOptions
    );
    app.activeDocument = this.document;

    exportLayer.path = unescape(this.getUriRelativeToJsonPath(savedFile));
    exportLayer.bounds = translateNumericBounds(
      unitValueArrayAs(isolatedLayer.bounds, "px"),
      this.globalBoundsTranslation
    );
  };

  proto.getUriRelativeToJsonPath = function (file) {
    return file.getRelativeURI(this.outJsonFile.parent.absoluteURI);
  };

  proto.shouldEnterLayerSet = function (layerSnapshot) {
    return call(this.shouldEnterLayerSetFunc, layerSnapshot);
  };

  proto.shouldExportLayer = function (layerSnapshot) {
    return call(this.shouldExportLayerFunc, layerSnapshot);
  };

  proto.log = function (message) {
    call(this.logFunction, message);
  };
}(Exporter.prototype));


/**
 * Exports a Photoshop document's layers as images + JSON metadata.
 *
 * @param {string|File|Document} photoshopDocument The document to export. If
 *   this is a String or File object, it will be opened (or foregrounded if
 *   already open).
 * @param {string|File} outJsonFile The path of the output JSON metadata.
 * @param {string|Folder} outLayerImageFolder The root folder to contain layer
 *   image files.
 * @param {Object} options Options controlling the export.
 * @param {Boolean} [options.flattenOpacity=true] Whether to flatten layer
 *   opacity. If `true` (the default), layers will be exported at their current
 *   opacity. For example, a layer set to 25% opacity, containing fully-opaque
 *   pixels, will appear 25% opaque in the exported image file.  If `false`,
 *   layers will have their opacity set to 100% before exporting, and their
 *   original opacity will appear in the JSON file under an `opacity` property,
 *   in the range 0-100.
 * @param {Boolean} [options.exportTree=true] Whether to reflect the structure
 *   of layer sets (layer folders) in the JSON file. If `true` (the default),
 *   layer sets will appear in the JSON file with a `set` key set to the value
 *   `true`, and child layers/sets will appear in a `layers` array of its own.
 *   If `false`, all layer sets will be omitted and all layers will appear in a
 *   root-level 'layers' array in the same order they appear in the Photoshop
 *   document (i.e. a depth-first traversal).
 * @param {Boolean} [options.outsideBounds=false] Whether to export the
 *   entirety of layers that fall outside the document canvas. If `false`,
 *   layers that are partially outside the document canvas will be cropped to
 *   the document edges, and layers that are wholly outside the canvas will be
 *   skipped. If `true`, all layers will be exported fully. This is achieved by
 *   executing Image > Reveal All, though layer coordinates use the top left of
 *   the original document as its origin. This means that layer bounds can be
 *   negative in this mode.
 * @param {Boolean} [options.verbose=false] If `true`, log progress
 *   information to the Debug Console. The default is `false`.
 * @param {Boolean|EnterLayerSetCallback} [options.shouldEnterLayerSet=false]
 *   A {@link EnterLayerSetCallback} that decides whether a layer set should
 *   have its contents exported individually. When a layer set is encountered,
 *   a {@link LayerSnapshot} of it is passed to this callback, and its return
 *   value is used. If the callback returns `true`, its contents will be
 *   individually considered for export. If `false`, the layer set is treated
 *   like a flat layer. `true` or `false` can also be used here, which will be
 *   treated like a function that always returns that value for all layer sets.
 * @param {Boolean|ImageFormat|ExportLayerCallback} [options.shouldExportLayer=true]
 *   A {@link ExportLayerCallback} that decides whether, and how, a layer
 *   should be saved to an image file. If the callback returns a falsy value,
 *   the layer is skipped - it will not be exported to an image and it won't
 *   appear in the JSON metadata. If the callback returns `true`, the layer
 *   will appear in the JSON metadata and be exported as a PNG with
 *   transparency (using the Save As dialog, rather than Save for Web). Other
 *   callback return values are interpreted as an {@link ImageFormat}. If a
 *   literal value is provided instead of a function, it will be treated as a
 *   function that returns that value regardless of layer.
 * @param {ExtraLayerDataCallback} [options.extraLayerData=null] A callback
 *   which returns extra data to be added to the layer's exported metadata. If
 *   provided, it is called for each layer and layer set that is either entered
 *   or exported, passing in a `LayerSnapshot`. The value returned by this
 *   function will appear in a `data` property among the layer's metadata.
 * @param {string} [options.fileNaming='hash'] A string specifying the means of
 *   generating layer image filenames. The possible values are: `'hash'`, which
 *   generates a hexadecimal hash from each layer's name, `'counter'`, which
 *   uses a simple increasing counter, and `'layerPath'`, which uses the
 *   layer's name, prepended by the names of its parent layer sets if any. All
 *   generated filenames are appended with an extra number to guard against
 *   duplicate names.
 */
function exportDocument(
  photoshopDocument,
  outJsonFile,
  outLayerImageFolder,
  options
) {
  var exporter = new Exporter();

  if (typeof outJsonFile === "string") {
    exporter.outJsonFile = new File(outJsonFile);
  } else if (outJsonFile instanceof File) {
    exporter.outJsonFile = outJsonFile;
  } else {
    throw new Error("outJsonFile must be a string or a File");
  }

  if (outLayerImageFolder == null) {
    exporter.outLayerImageFolder = exporter.outJsonFile.parent;
  } else if (typeof outLayerImageFolder === "string") {
    exporter.outLayerImageFolder = new Folder(outLayerImageFolder);
  } else if (outLayerImageFolder instanceof Folder) {
    exporter.outLayerImageFolder = outLayerImageFolder;
  } else {
    throw new Error("outLayerImageFolder, if specified, must be a string or a Folder");
  }

  if (typeof photoshopDocument === "string") {
    exporter.document = app.open(new File(photoshopDocument));
  } else if (photoshopDocument instanceof File) {
    exporter.document = app.open(photoshopDocument);
  } else {
    exporter.document = photoshopDocument;
  }

  if (!options) {
    options = { };
  }

  exporter.flattenOpacity = options.flattenOpacity !== false;
  exporter.tree = options.tree !== false;
  exporter.outsideBounds = Boolean(options.outsideBounds);
  exporter.logFunction = options.verbose ? log : null;
  exporter.shouldEnterLayerSetFunc = coerceBooleanFunction(options.shouldEnterLayerSet, false);
  exporter.shouldExportLayerFunc = coerceBooleanFunction(options.shouldExportLayer, true);
  exporter.extraLayerDataFunc = options.extraLayerData;

  var namerFactory =
    NAMING_STRATEGY_LOOKUP[options.fileNaming] ||
    DEFAULT_NAMING_STRATEGY;

  exporter.generateName = namerFactory();

  return exporter.run();
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
