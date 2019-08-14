/*global
  $,
  LayerKind,
  UnitValue,
*/
"use strict";


var arraycopy = require("./arraycopy");


function arrayContains(search, value) {
  for (var i = 0; i < search.length; i++) {
    if (search[i] === value) {
      return true;
    }
  }
  return false;
}


var IGNORABLE_ERROR_PATTERN =
  /General.Photoshop.error.occurred.+This.functionality.may.not.be.available/i;

function isIgnorableError(error) {
  return error && IGNORABLE_ERROR_PATTERN.test(String(error));
}


function copyProps(source, target, propFuncPairs) {
  for (var i = 0; i < propFuncPairs.length; i++) {
    var pair = propFuncPairs[i];
    var name = pair[0];
    var copyFunc = pair[1];

    // Not all versions of Photoshop support the full set of properties. Only
    // copy the ones that exist.
    if (name in source) {
      try {
        target[name] = copyFunc ? copyFunc(source[name]) :
                                  source[name];
      } catch (error) {
        if (!isIgnorableError(error)) {
          $.writeln("copyProps: caught error while copying property '" + name + "': " + error);
        }
        target[name] = null;
      }
    }
  }
  return target;
}


function copyUnitValue(uv) {
  return new UnitValue(uv.value, uv.type);
}


function mapper(mapFunction) {
  function m(array) {
    var result = [ ];
    for (var i = 0; i < array.length; i++) {
      result.push(mapFunction(array[i]));
    }
    return result;
  }
  return m;
}


function copyTextItem(ti) {
  return copyProps(ti, { }, [
    [ "alternateLigatures", null ],
    [ "antiAliasMethod", null ],
    [ "autoKerning", null ],
    [ "autoLeadingAmount", null ], // valid when useAutoLeading == true
    [ "baselineShift", copyUnitValue ],
    [ "capitalization", null ],
    [ "color", null ],
    [ "contents", null ],

    // valid only when justification == Justification.CENTERJUSTIFIED,
    // FULLYJUSTIFIED, LEFTJUSTIFIED or RIGHTJUSTIFIED
    [ "desiredGlyphScaling", null ],
    [ "desiredLetterScaling", null ],
    [ "desiredWordScaling", null ],

    [ "direction", null ],
    [ "fauxBold", null ],
    [ "fauxItalic", null ],
    [ "firstLineIndent", null ],
    [ "font", null ],
    [ "hangingPunctuation", null ],
    [ "height", copyUnitValue ], // valid when kind == TextType.PARAPGRAPHTEXT
    [ "horizontalScale", null ],
    [ "hyphenateAfterFirst", null ],
    [ "hyphenateBeforeLast", null ],
    [ "hyphenateCapitalWords", null ],
    [ "hyphenateWordsLongerThan", null ],
    [ "hyphenation", null ],
    [ "hyphenationZone", copyUnitValue ],
    [ "hyphenLimit", null ],
    [ "justification", null ],
    [ "kind", null ],
    [ "language", null ],
    [ "leading", copyUnitValue ],
    [ "leftIndent", copyUnitValue ],
    [ "ligatures", null ],

    // valid only when justification == Justification.CENTERJUSTIFIED,
    // FULLYJUSTIFIED, LEFTJUSTIFIED or RIGHTJUSTIFIED
    [ "maximumGlyphScaling", null ],
    [ "maximumLetterScaling", null ],
    [ "maximumWordScaling", null ],
    [ "minimumGlyphScaling", null ],
    [ "minimumLetterScaling", null ],
    [ "minimumWordScaling", null ],

    [ "noBreak", null ],
    [ "oldStyle", null ],
    [ "position", mapper(copyUnitValue) ],
    [ "rightIndent", copyUnitValue ],
    [ "size", copyUnitValue ],
    [ "spaceAfter", copyUnitValue ],
    [ "spaceBefore", copyUnitValue ],
    [ "strikeThru", null ],
    [ "textComposer", null ], // valid when kind == TextType.PARAPGRAPHTEXT
    [ "tracking", null ],
    [ "underline", null ],
    [ "useAutoLeading", null ],
    [ "verticalScale", null ],
    [ "warpBend", null ],
    [ "warpDirection", null ],
    [ "warpHorizontalDistortion", null ],
    [ "warpStyle", null ],
    [ "warpVerticalDistortion", null ],
    [ "width", copyUnitValue ] // valid when kind == TextType.PARAPGRAPHTEXT
  ]);
}


var SNAPSHOT_LAYER_KIND = [
  [ "isAdjustmentLayer", [
    LayerKind.BLACKANDWHITE,
    LayerKind.BRIGHTNESSCONTRAST,
    LayerKind.CHANNELMIXER,
    LayerKind.COLORBALANCE,
    LayerKind.CURVES,
    LayerKind.EXPOSURE,
    LayerKind.GRADIENTMAP,
    LayerKind.HUESATURATION,
    LayerKind.INVERSION,
    LayerKind.LEVELS,
    LayerKind.PHOTOFILTER,
    LayerKind.POSTERIZE,
    LayerKind.SELECTIVECOLOR,
    LayerKind.THRESHOLD,
    LayerKind.VIBRANCE
  ] ],

  [ "isFillLayer", [
    LayerKind.GRADIENTFILL,
    LayerKind.PATTERNFILL,
    LayerKind.SOLIDFILL
  ] ],

  [ "isImageLayer", [
    LayerKind.NORMAL,
    LayerKind.SMARTOBJECT
  ] ],

  [ "isSmartObject", [ LayerKind.SMARTOBJECT ] ],
  [ "isTextLayer",   [ LayerKind.TEXT ] ],
  [ "is3DLayer",     [ LayerKind.LAYER3D ] ],
  [ "isVideoLayer",  [ LayerKind.VIDEO ] ]
];

function addCommonSnapshotProperties(s) {
  s.isDocument = s.typename === "Document";
  s.isArtLayer = s.typename === "ArtLayer";
  s.isLayerSet = s.typename === "LayerSet";
  s.isLayer = s.isArtLayer || s.isLayerSet;
  s.isContainer = s.isDocument || s.isLayerSet;

  for (var i = 0; i < SNAPSHOT_LAYER_KIND.length; i++) {
    var propertyName = SNAPSHOT_LAYER_KIND[i][0];
    if (s.isArtLayer) {
      var matchingLayerKinds = SNAPSHOT_LAYER_KIND[i][1];
      s[propertyName] = arrayContains(matchingLayerKinds, s.kind);
    } else {
      s[propertyName] = false;
    }
  }
}


function DocumentSnapshot(doc) {
  this.live = doc;

  copyProps(doc, this, [
    [ "bitsPerChannel", null ],
    // [ "channels", null ],
    [ "colorProfileName", null ],
    [ "colorProfileType", null ],
    [ "colorSamplers", arraycopy ],
    // [ "componentChannels", null ],
    // [ "countItems", null ],
    [ "fullName", null ], // a File object representing this document's file
    // [ "guides", null ],
    [ "height", copyUnitValue ],
    // [ "histogram", null ],
    // [ "historyStates", null ],
    // [ "info", null ],
    // [ "layerComps", null ],
    [ "managed", null ], // Support dropped by Photoshop CC 2018
    // [ "measurementScale", null ],
    [ "mode", null ],
    [ "name", null ],

    // the docs explain this badly but this is the folder that the file is
    // stored in. in other words, it is doc.fullName.parent. it is a Folder
    // object
    [ "path", null ],

    // [ "pathItems", null ],
    [ "pixelAspectRatio", null ],
    // [ "printSettings", null ],
    [ "resolution", null ],
    [ "saved", null ],
    // [ "selection", null ],
    [ "typename", null ],
    [ "width", copyUnitValue ],
    [ "xmpMetadata", null ], // Should there be a copy function for this?
  ]);

  this.size = [ this.width, this.height ];
  this.bounds = [
    new UnitValue(0, this.width.type),
    new UnitValue(0, this.height.type),
    this.width,
    this.height
  ];

  this.layers =
  this.artLayers =
  this.layerSets = null;

  this.depth = 0;
  this.index = 0;
  this.layerPath = [ ];
  this.indexPath = [ ];
  this.parent = null;
  this.document = this;

  addCommonSnapshotProperties(this);
}


/**
 * Constructs a new `LayerSnapshot` from an `ArtLayer` or `LayerSet`
 * @class
 *
 * @classdesc
 * The intial state of a layer or layer set.
 *
 * Objects of this class are used with callbacks in lieu of Photoshop's actual
 * ArtLayer and LayerSet classes. They present a copy of a layer/layer set's
 * initial state, rather than its live state, which is subject to change as the
 * export script runs. Being lightweight copies, they're also faster to query
 * as they don't interact with Photoshop's state.
 *
 * Most properties have the same name and value type as ArtLayer or LayerSet.
 * Some derived properties are added for convenience. (TODO)
 */
function LayerSnapshot(layer) {
  this.live = layer;

  // common
  copyProps(layer, this, [
    [ "allLocked", null ],
    [ "blendMode", null ],
    [ "bounds", mapper(copyUnitValue) ],

    // these end up being live layers, should they be LayerSnapshots?
    [ "linkedLayers", arraycopy ],

    [ "name", null ],
    [ "opacity", null ],
    [ "typename", null ],
    [ "visible", null ],
  ]);

  this.size = [
    this.bounds[2] - this.bounds[0],
    this.bounds[3] - this.bounds[1]
  ];

  switch (this.typename) {
  case "ArtLayer":
    copyProps(layer, this, [
      [ "boundsNoEffects", mapper(copyUnitValue) ],
      [ "fillOpacity", null ],
      [ "filterMaskDensity", null ],
      [ "filterMaskFeather", null ],
      [ "grouped", null ],
      [ "isBackgroundLayer", null ],
      [ "kind", null ],
      [ "layerMaskDensity", null ],
      [ "layerMaskFeather", null ],
      [ "pixelsLocked", null ],
      [ "positionLocked", null ],
      [ "transparentPixelsLocked", null ],
      [ "vectorMaskDensity", null ],
      [ "vectorMaskFeather", null ],
      [ "xmpMetadata", null ], // Should there be a copy function for this?
    ]);

    this.textItem = null;
    if (layer.kind === LayerKind.TEXT) {
      copyProps(layer, this, [
        [ "textItem", copyTextItem ]
      ]);
    }

    if (this.boundsNoEffects) {
      this.sizeNoEffects = [
        this.boundsNoEffects[2] - this.boundsNoEffects[0],
        this.boundsNoEffects[3] - this.boundsNoEffects[1]
      ];
    }
    break;

  case "LayerSet":
    copyProps(layer, this, [
      [ "enabledChannels", arraycopy ]
    ]);

    this.grouped = false;
    this.layers =
    this.artLayers =
    this.layerSets = null;
    break;
  }

  this.clippedBy = null; // lower layer that clips this one. only possible with ArtLayer
  this.clippedLayers = [ ]; // higher layers clipped by this one. possible with either LayerSet or ArtLayer

  this.anyLocked = this.allLocked ||
                   this.pixelsLocked ||
                   this.positionLocked ||
                   this.transparentPixelsLocked;

  this.depth = NaN;
  this.index = NaN;
  this.layerPath = null;
  this.indexPath = null;
  this.parent = null;
  this.document = null;

  addCommonSnapshotProperties(this);
}


var CommonMethods = {
  prepare: function () {
    if (!this.isContainer) {
      return this;
    }

    var liveLayers = this.live.layers;
    var len = liveLayers.length;
    var clippedSnapshots = [ ];

    this.layers = [ ];
    this.artLayers = [ ];
    this.layerSets = [ ];

    for (var i = 0; i < len; i++) {
      var liveLayer = liveLayers[i];
      var layerSnapshot = new LayerSnapshot(liveLayer);

      layerSnapshot.depth = this.depth + 1;
      layerSnapshot.index = i;
      layerSnapshot.layerPath = this.layerPath.concat([ layerSnapshot.name ]);
      layerSnapshot.indexPath = this.indexPath.concat([ layerSnapshot.index ]);
      layerSnapshot.parent = this;
      layerSnapshot.document = this.document;

      if (layerSnapshot.grouped) {
        clippedSnapshots.push(layerSnapshot);
      } else {
        while (clippedSnapshots.length > 0) {
          var clippedLayer = clippedSnapshots.shift();
          clippedLayer.clippedBy = layerSnapshot;
          layerSnapshot.clippedLayers.push(clippedLayer);
        }
        this.layers.push(layerSnapshot);
        if (layerSnapshot.isArtLayer) {
          this.artLayers.push(layerSnapshot);
        } else if (layerSnapshot.isLayerSet) {
          this.layerSets.push(layerSnapshot);
        }
      }

      if (layerSnapshot.visible) {
        layerSnapshot.live.visible = false;
      }
    }

    return this;
  }
};


(function (p) {
p.prepare = CommonMethods.prepare;

p.setLiveVisible = function (_) {
  // nothing
};

p.toString = function () {
  return "[DocumentSnapshot '" + this.name + "']";
};
}(DocumentSnapshot.prototype));


(function (p) {
p.prepare = CommonMethods.prepare;

p.setLiveVisible = function (newVisible) {
  this.live.visible = newVisible;
  for (var i = 0; i < this.clippedLayers.length; i++) {
    var clippedLayer = this.clippedLayers[i];
    if (clippedLayer.visible) {
      clippedLayer.live.visible = clippedLayer.visible && newVisible;
    }
  }
};

p.toString = function () {
  return "[LayerSnapshot " + this.typename + " '" + this.name + "']";
};
}(LayerSnapshot.prototype));


module.exports = {
  DocumentSnapshot: DocumentSnapshot,
  LayerSnapshot:    LayerSnapshot
};
