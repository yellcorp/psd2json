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
  OperatingSystem,
  PNGSaveOptions,
  Palette,
  SaveDocumentType,
  TIFFEncoding,
  TargaBitsPerPixels,
  TargaSaveOptions,
  TiffSaveOptions,
*/
"use strict";


var c = require("./converters");


function getOwn(object, key) {
  if (Object.prototype.hasOwnProperty.call(object, key)) {
    return object[key];
  }
  return undefined;
}


function mergeDelegates() {
  var merged = {
    create: null,
    schema: []
  };

  for (var i = 0; i < arguments.length; i++) {
    var delegate = arguments[i];
    if (delegate) {
      if (delegate.create) {
        merged.create = delegate.create;
      }

      if (delegate.schema) {
        merged.schema = merged.schema.concat(delegate.schema);
      }
    }
  }

  return merged;
}


var EXPORT_COMMON = {
  create: function () { return new ExportOptionsSaveForWeb(); },
  schema: [
    ["blur",           c.finitePositiveNumber(0)],
    ["includeProfile", c.interpretEmbedColorProfile],
    ["interlaced",     c.booleanValue(false)],
    ["matteColor",     c.rgbColor]
  ]
};


var PALETTED_COMMON = {
  schema: [
    ["colors",       c.intInRange(2, 256, 256)],
    ["dither",       c.enumValue(Dither, Dither.DIFFUSION)],
    ["ditherAmount", c.intInRange(0, 100, 100)],
    ["transparency", c.booleanValue(true)]
  ]
};


var EXPORT_PALETTED_COMMON = mergeDelegates(EXPORT_COMMON, PALETTED_COMMON, {
  schema: [
    ["colorReduction",     c.enumValue(ColorReductionType, ColorReductionType.SELECTIVE)],
    ["lossy",              c.intInRange(0, 100, 0)],
    ["transparencyDither", c.enumValue(Dither, Dither.NONE)],
    ["transparencyAmount", c.intInRange(0, 100, 100)],
    ["webSnap",            c.intInRange(0, 100, 0)]
  ]
});


var EXPORT_GIF = mergeDelegates(EXPORT_PALETTED_COMMON, {
  schema: [
    ["format", c.constValue(SaveDocumentType.COMPUSERVEGIF)]
  ]
});


var EXPORT_JPEG = mergeDelegates(EXPORT_COMMON, {
  schema: [
    ["format",       c.constValue(SaveDocumentType.JPEG)],
    ["quality",      c.intInRange(0, 100, 1000 / 12)],
    ["optimized",    c.booleanValue(true)],
    ["transparency", c.constValue(false)]
  ]
});


var EXPORT_PNG24 = mergeDelegates(EXPORT_COMMON, {
  schema: [
    ["transparency", c.constValue(true)],
    ["format",       c.constValue(SaveDocumentType.PNG)],
    ["PNG8",         c.constValue(false)]
  ]
});


var EXPORT_PNG8 = mergeDelegates(EXPORT_PALETTED_COMMON, {
  schema: [
    ["format", c.constValue(SaveDocumentType.PNG)],
    ["PNG8",   c.constValue(true)]
  ]
});


var SAVE_BMP = {
  create: function () { return new BMPSaveOptions(); },
  schema: [
    ["alphaChannels",  c.constValue(true)],
    ["depth",          c.constValue(BMPDepthType.BMP_A8R8G8B8)],
    ["flipRowOrder",   c.booleanValue(false)],

    // Other choice is .OS2, which isn't gonna happen
    ["osType",         c.constValue(OperatingSystem.WINDOWS)],

    ["rleCompression", c.booleanValue(true)]
  ]
};


var SAVE_GIF = mergeDelegates(PALETTED_COMMON, {
  create: function () { return new GIFSaveOptions(); },
  schema: [
    ["forcedColors",        c.enumValue(ForcedColors, ForcedColors.NONE)],
    ["matte",               c.enumValue(MatteType,    MatteType.NONE)],
    ["palette",             c.enumValue(Palette,      Palette.LOCALSELECTIVE)],
    ["interlaced",          c.booleanValue(false)],
    ["preserveExactColors", c.booleanValue(false)]
  ]
});


var SAVE_JPEG = {
  create: function () { return new JPEGSaveOptions(); },
  schema: [
    ["embedColorProfile", c.interpretEmbedColorProfile],
    ["formatOptions",     c.enumValue(FormatOptions, FormatOptions.OPTIMIZEDBASELINE)],
    ["matte",             c.enumValue(MatteType,     MatteType.BLACK)],
    ["quality",           c.scaleToIntRange(0, 100, 0, 12, 10)],
    ["scans",             c.intInRange(3, 5, 3)]
  ]
};


var SAVE_PNG = {
  create: function () { return new PNGSaveOptions(); },
  schema: [
    ["compression", c.intInRange(0, 9, 4)],
    ["interlaced",  c.booleanValue(false)]
  ]
};


var SAVE_TARGA = {
  create: function () { return new TargaSaveOptions(); },
  schema: [
    ["alphaChannels",  c.constValue(true)],
    ["resolution",     c.constValue(TargaBitsPerPixels.THIRTYTWO)],
    ["rleCompression", c.booleanValue(true)]
  ]
};


var SAVE_TIFF = {
  create: function () { return new TiffSaveOptions(); },
  schema: [
    ["alphaChannels",      c.booleanValue(false)],
    ["annotations",        c.booleanValue(false)],
    ["byteOrder",          c.enumValue(ByteOrder, ByteOrder.IBM)],
    ["embedColorProfile",  c.interpretEmbedColorProfile],
    ["imageCompression",   c.enumValue(TIFFEncoding, TIFFEncoding.NONE)],
    ["interleaveChannels", c.booleanValue(true)],
    ["jpegQuality",        c.scaleToIntRange(0, 100, 0, 12, 10)],
    ["layers",             c.booleanValue(false)],
    ["saveImagePyramid",   c.booleanValue(false)],
    ["spotColors",         c.booleanValue(false)],
    ["transparency",       c.booleanValue(true)]
  ]
};


var EXPORTERS = {
  gif: EXPORT_GIF,
  jpg: EXPORT_JPEG,
  png: EXPORT_PNG24,
  png8: EXPORT_PNG8
};


var SAVERS = {
  bmp: SAVE_BMP,
  gif: SAVE_GIF,
  jpg: SAVE_JPEG,
  png: SAVE_PNG,
  tga: SAVE_TARGA,
  tif: SAVE_TIFF
};


var ALIASES = {
  jpeg: "jpg",
  targa: "tga",
  tiff: "tif"
};


function normalizeFormatKey(key) {
  key = String(key).toLowerCase();
  return getOwn(ALIASES, key) || key;
}


function getDelegate(formatKey, preferExporter) {
  formatKey = normalizeFormatKey(formatKey);

  var saver = getOwn(SAVERS, formatKey);
  var exporter = getOwn(EXPORTERS, formatKey);

  return preferExporter ?
    (exporter || saver) :
    (saver || exporter);
}


function getExporter(formatKey) {
  return getDelegate(formatKey, true);
}


function getSaver(formatKey) {
  return getDelegate(formatKey, false);
}


exports.getExporter = getExporter;
exports.getSaver = getSaver;
