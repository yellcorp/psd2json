/*global
  BMPDepthType,
  BMPSaveOptions,
  ByteOrder,
  ColorReductionType,
  Dither,
  ExportOptionsSaveForWeb,
  ForcedColors,
  FormatOptions,
  GIFSaveOptions,
  JPEGSaveOptions,
  MatteType,
  PNGSaveOptions,
  Palette,
  SaveDocumentType,
  SaveDocumentType,
  TIFFEncoding,
  TargaBitsPerPixels,
  TargaSaveOptions,
  TiffSaveOptions,
*/
"use strict";


var SKIP = { };

function embedColorProfile(arg) {
  return Boolean(arg.object.embedColorProfile || arg.object.includeProfile);
}

function enumValue(enumClass, defaultValue) {
  return function (arg) {
    if (arg.set) {
      if (typeof arg.value === "string") {
        return enumClass[arg.value.toUpperCase()];
      }
    }
    return defaultValue;
  };
}

function intInRange(low, high, defaultValue) {
  return function (arg) {
    var value = defaultValue;
    if (arg.set) {
      if (low <= arg.value && arg.value <= high) {
        value = arg.value;
      }
    }
    return Math.round(value);
  };
}

function scaleToIntRange(inLow, inHigh, outLow, outHigh, outDefault) {
  return function (arg) {
    if (arg.set) {
      var outValue = outLow + (outHigh - outLow) * (arg.value - inLow) / (inHigh - inLow);
      if (outLow <= outValue && outValue <= outHigh) {
        return Math.round(outValue);
      }
    }
    return outDefault;
  };
}

function finiteNumber(defaultValue) {
  return function (arg) {
    if (arg.set && isFinite(arg.value)) {
      return +arg.value;
    }
    return defaultValue;
  };
}

function booleanValue(defaultValue) {
  return function (arg) {
    return Boolean(arg.set ? arg.value : defaultValue);
  };
}

function constValue(value) {
  return function (_) {
    return value;
  };
}

function extend() {
  var result = { };
  for (var i = 0; i < arguments.length; i++) {
    var obj = arguments[i];
    for (var k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        result[k] = obj[k];
      }
    }
  }
  return result;
}

var formatJpegSave = {
  _new:              function () { return new JPEGSaveOptions(); },
  embedColorProfile: embedColorProfile,
  formatOptions:     enumValue(FormatOptions, FormatOptions.OPTIMIZEDBASELINE),
  matte:             enumValue(MatteType,     MatteType.BLACK),
  quality:           scaleToIntRange(0, 100, 0, 12, 10),
  scans:             intInRange(3, 5, 3)
};

var formatJpegExport = {
  _new:              function () { return new ExportOptionsSaveForWeb(); },
  format:            constValue(SaveDocumentType.JPEG),
  blur:              finiteNumber(0),
  includeProfile:    embedColorProfile,
  quality:           intInRange(0, 100, 1000 / 12),
  optimized:         booleanValue(true),
  transparency:      booleanValue(true)
};

var formatGifCommon = {
  colors:       intInRange(2, 256, 256),
  dither:       enumValue(Dither, Dither.DIFFUSION),
  ditherAmount: intInRange(0, 100, 100),
  interlaced:   booleanValue(false),
  transparency: booleanValue(true)
};

var formatGifSave = extend(formatGifCommon, {
  _new:                function () { return new GIFSaveOptions(); },
  forcedColors:        enumValue(ForcedColors, ForcedColors.NONE),
  matte:               enumValue(MatteType,    MatteType.NONE),
  palette:             enumValue(Palette,      Palette.LOCALSELECTIVE),
  preserveExactColors: booleanValue(false)
});

var formatGifExport = extend(formatGifCommon, {
  _new:               function () { return new ExportOptionsSaveForWeb(); },
  format:             constValue(SaveDocumentType.COMPUSERVEGIF),
  blur:               finiteNumber(0),
  colorReduction:     enumValue(ColorReductionType, ColorReductionType.SELECTIVE),
  includeProfile:     embedColorProfile,
  lossy:              intInRange(0, 100, 0),
  // TODO matteColor
  transparencyDither: enumValue(Dither, Dither.NONE),
  transparencyAmount: intInRange(0, 100, 100),
  webSnap:            intInRange(0, 100, 0)
});

var formatPngCommon = {
  interlaced:   booleanValue(false),
};

var formatPngSave = extend(formatPngCommon, {
  _new:         function () { return new PNGSaveOptions(); },
  compression:  intInRange(0, 9, 4)
});

var formatPngExport = extend(formatPngCommon, {
  _new:               function () { return new ExportOptionsSaveForWeb(); },
  format:             constValue(SaveDocumentType.PNG),
  blur:               finiteNumber(0),
  includeProfile:     embedColorProfile,
  PNG8:               constValue(false)
});

var formatTargaSave = {
  _new:               function () { return new TargaSaveOptions(); },
  alphaChannels:      constValue(true),
  resolution:         constValue(TargaBitsPerPixels.THIRTYTWO),
  rleCompression:     booleanValue(true)
};

var formatTiffSave = {
  _new:               function () { return new TiffSaveOptions(); },
  alphaChannels:      constValue(true),
  annotations:        booleanValue(false),
  byteOrder:          enumValue(ByteOrder, ByteOrder.IBM),
  embedColorProfile:  embedColorProfile,
  imageCompression:   enumValue(TIFFEncoding, TIFFEncoding.NONE),
  interleaveChannels: booleanValue(true),
  jpegQuality:        scaleToIntRange(0, 100, 0, 12, 10),
  layers:             constValue(false),
  saveImagePyramid:   constValue(false),
  spotColors:         constValue(false),
  transparency:       constValue(true)
};

var formatBmpSave = {
  alphaChannels:      constValue(true),
  depth:              constValue(BMPDepthType.BMP_A8R8G8B8),
  rleCompression:     booleanValue(true)
};

var exportLookup = {
  gif:   formatGifExport,
  jpeg:  formatJpegExport,
  jpg:   formatJpegExport,
  png:   formatPngExport
};

var saveLookup = {
  bmp:   formatBmpSave,
  gif:   formatGifSave,
  jpeg:  formatJpegSave,
  jpg:   formatJpegSave,
  png:   formatPngSave,
  targa: formatTargaSave,
  tga:   formatTargaSave,
  tif:   formatTiffSave,
  tiff:  formatTiffSave
};


function marshal(schema, object) {
  var outObject = schema._new();
  for (var k in schema) {
    if (k !== "_new" && Object.prototype.hasOwnProperty.call(schema, k)) {
      var arg = {
        key:    k,
        value:  object[k],
        object: object,
        set:    Object.prototype.hasOwnProperty.call(object, k)
      };

      var outValue = schema[k](arg);
      if (outValue !== SKIP) {
        outObject[k] = outValue;
      }
    }
  }
  return outObject;
}


function interpret(object, defaultOptions) {
  if (!object || object === true) {
    return defaultOptions;
  }

  if (
    object instanceof JPEGSaveOptions  ||
    object instanceof PNGSaveOptions   ||
    object instanceof BMPSaveOptions   ||
    object instanceof GIFSaveOptions   ||
    object instanceof TargaSaveOptions ||
    object instanceof TiffSaveOptions  ||
    object instanceof ExportOptionsSaveForWeb
  ) {
    return object;
  }

  if (typeof object === "string") {
    object = {
      format: object,
      web: true
    };
  }

  var formatString = String(object.format).toLowerCase();

  var schema;
  if (object.web) {
    schema = exportLookup[formatString];
  }
  if (!schema) {
    schema = saveLookup[formatString];
  }
  if (!schema) {
    return defaultOptions;
  }

  return marshal(schema, object);
}


function extensionForOptions(saveOptions) {
  /*eslint max-statements-per-line: off */
  if (saveOptions instanceof BMPSaveOptions)   { return ".bmp"; }
  if (saveOptions instanceof GIFSaveOptions)   { return ".gif"; }
  if (saveOptions instanceof JPEGSaveOptions)  { return ".jpg"; }
  if (saveOptions instanceof PNGSaveOptions)   { return ".png"; }
  if (saveOptions instanceof TargaSaveOptions) { return ".tga"; }
  if (saveOptions instanceof TiffSaveOptions)  { return ".tif"; }
  if (saveOptions instanceof ExportOptionsSaveForWeb) {
    switch (saveOptions.format) {
      case SaveDocumentType.BMP:           return ".bmp";
      case SaveDocumentType.COMPUSERVEGIF: return ".gif";
      case SaveDocumentType.JPEG:          return ".jpg";
      case SaveDocumentType.PNG:           return ".png";
    }
  }
  return null;
}


module.exports = {
  extensionForOptions: extensionForOptions,
  interpret:           interpret
};
