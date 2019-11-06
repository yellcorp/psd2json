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
  RGBColor,
  SolidColor,
*/
"use strict";


var psutil = require('./psutil');


function finitePositiveNumber(defaultValue) {
  return function (input) {
    return (
      input.isSet &&
      isFinite(input.value) &&
      input.value >= 0
    ) ? Number(input.value) : defaultValue;
  };
}

function interpretEmbedColorProfile(input) {
  return Boolean(input.context.embedColorProfile || input.context.includeProfile);
}

var WEB_COLOR = /^(?:#|0x)?((?:[0-9a-f]{3}){2})$/i;
function colorValueToHex6(value) {
  if (
    typeof value === "number" &&
    isFinite(value) &&
    value >= 0
  ) {
    return ("00000" + value.toString(16)).slice(-6);
  }

  if (typeof value === "string") {
    var match = WEB_COLOR.exec(value);
    if (match) {
      var digits = match[1];
      if (digits.length === 6) {
        return digits;
      }
      return digits[0] + digits[0] + digits[1] + digits[1] + digits[2] + digits[2];
    }
  }

  return null;
}

function rgbColor(input) {
  var color;

  if (input.isSet) {
    if (input.value instanceof RGBColor) {
      return input.value;
    }

    if (input.value instanceof SolidColor) {
      return input.value.rgb;
    }

    var asHex = colorValueToHex6(input.value);
    if (asHex) {
      color = new RGBColor();
      color.hexValue = asHex;
      return color;
    }
  }

  return input.ignore();
}

function enumValue(enumClass, defaultValue) {
  // Photoshop enums are a little touchy - at least if you try to introspect
  // them. `for (k in EnumClass)` doesn't catch all the keys. `instanceof`
  // causes errors. The strategy here is to convert everything to a string,
  // strip anything before the first dot, uppercase it, and see if the enum
  // class has it.
  return function (input) {
    if (input.isSet) {
      var key = psutil.enumName(input.value);
      var error;

      // There are a few things broken in the ExtendScript engine that result
      // in the following cryptic message appearing in VSCode:
      // ```
      // (#15)Cannot execute script in target engine 'main'!
      // ```
      // 1. Have to assign the attempted operation to a var, then return.
      //    Can't one-line it.
      // 2. Can't rethrow the caught error from within the catch block. Have to
      //    store it away, then check and rethrow after exiting it.
      //
      // Incidentally, this message is the same one that appears unhelpfully
      // when one or more files contain one or more SyntaxErrors.
      try {
        var result = enumClass[key.toUpperCase()];
        return result;
      } catch (lookupError) {
        error = lookupError;
      }

      if (error) {
        $.writeln(
          "Error: Couldn't interpret " +
          input.value +
          " as a member of enum " +
          enumClass
        );
        throw error;
      }
    }

    return defaultValue;
  };
}

function intInRange(low, high, defaultValue) {
  return function (input) {
    var value = defaultValue;
    if (input.isSet) {
      if (low <= input.value && input.value <= high) {
        value = input.value;
      }
    }
    return Math.round(value);
  };
}

function scaleToIntRange(inLow, inHigh, outLow, outHigh, outDefault) {
  return function (input) {
    if (input.isSet) {
      var outValue = outLow + (outHigh - outLow) * (input.value - inLow) / (inHigh - inLow);
      if (outLow <= outValue && outValue <= outHigh) {
        return Math.round(outValue);
      }
    }
    return outDefault;
  };
}

function booleanValue(defaultValue) {
  return function (input) {
    return Boolean(input.isSet ? input.value : defaultValue);
  };
}

function constValue(value) {
  return function (_unusedInput) {
    return value;
  };
}


function mergeAdapters() {
  var merged = {
    create: null,
    schema: []
  };

  for (var i = 0; i < arguments.length; i++) {
    var adapter = arguments[i];
    if (adapter) {
      if (adapter.create) {
        merged.create = adapter.create;
      }

      if (adapter.schema) {
        merged.schema = merged.schema.concat(adapter.schema);
      }
    }
  }

  return merged;
}


var COMMON_SAVE_FOR_WEB = {
  schema: [
    ["blur",           finitePositiveNumber(0)],
    ["includeProfile", interpretEmbedColorProfile]
  ]
};

var SAVE_JPEG = {
  create: function () { return new JPEGSaveOptions(); },
  schema: [
    ["embedColorProfile", interpretEmbedColorProfile],
    ["formatOptions",     enumValue(FormatOptions, FormatOptions.OPTIMIZEDBASELINE)],
    ["matte",             enumValue(MatteType,     MatteType.BLACK)],
    ["quality",           scaleToIntRange(0, 100, 0, 12, 10)],
    ["scans",             intInRange(3, 5, 3)]
  ]
};

var EXPORT_JPEG = mergeAdapters(COMMON_SAVE_FOR_WEB, {
  create: function () { return new ExportOptionsSaveForWeb(); },
  schema: [
    ["format",       constValue(SaveDocumentType.JPEG)],
    ["quality",      intInRange(0, 100, 1000 / 12)],
    ["optimized",    booleanValue(true)],
    ["transparency", booleanValue(true)]
  ]
});

var COMMON_GIF = {
  schema: [
    ["colors",       intInRange(2, 256, 256)],
    ["dither",       enumValue(Dither, Dither.DIFFUSION)],
    ["ditherAmount", intInRange(0, 100, 100)],
    ["interlaced",   booleanValue(false)],
    ["transparency", booleanValue(true)]
  ]
};

var SAVE_GIF = mergeAdapters(COMMON_GIF, {
  create: function () { return new GIFSaveOptions(); },
  schema: [
    ["forcedColors",        enumValue(ForcedColors, ForcedColors.NONE)],
    ["matte",               enumValue(MatteType,    MatteType.NONE)],
    ["palette",             enumValue(Palette,      Palette.LOCALSELECTIVE)],
    ["preserveExactColors", booleanValue(false)]
  ]
});

var EXPORT_GIF = mergeAdapters(COMMON_SAVE_FOR_WEB, COMMON_GIF, {
  create: function () { return new ExportOptionsSaveForWeb(); },
  schema: [
    ["format",             constValue(SaveDocumentType.COMPUSERVEGIF)],
    ["colorReduction",     enumValue(ColorReductionType, ColorReductionType.SELECTIVE)],
    ["lossy",              intInRange(0, 100, 0)],
    ["matteColor",         rgbColor],
    ["transparencyDither", enumValue(Dither, Dither.NONE)],
    ["transparencyAmount", intInRange(0, 100, 100)],
    ["webSnap",            intInRange(0, 100, 0)]
  ]
});

var COMMON_PNG = {
  schema: [
    ["interlaced", booleanValue(false)]
  ]
};

var SAVE_PNG = mergeAdapters(COMMON_PNG, {
  create: function () { return new PNGSaveOptions(); },
  schema: [
    ["compression", intInRange(0, 9, 4)]
  ]
});

var EXPORT_PNG = mergeAdapters(COMMON_SAVE_FOR_WEB, COMMON_PNG, {
  create: function () { return new ExportOptionsSaveForWeb(); },
  schema: [
    ["format", constValue(SaveDocumentType.PNG)],
    ["PNG8",   constValue(false)]
  ]
});

var SAVE_TARGA = {
  create: function () { return new TargaSaveOptions(); },
  schema: [
    ["alphaChannels",  constValue(true)],
    ["resolution",     constValue(TargaBitsPerPixels.THIRTYTWO)],
    ["rleCompression", booleanValue(true)]
  ]
};

var SAVE_TIFF = {
  create: function () { return new TiffSaveOptions(); },
  schema: [
    ["alphaChannels",      constValue(true)],
    ["annotations",        booleanValue(false)],
    ["byteOrder",          enumValue(ByteOrder, ByteOrder.IBM)],
    ["embedColorProfile",  interpretEmbedColorProfile],
    ["imageCompression",   enumValue(TIFFEncoding, TIFFEncoding.NONE)],
    ["interleaveChannels", booleanValue(true)],
    ["jpegQuality",        scaleToIntRange(0, 100, 0, 12, 10)],
    ["layers",             constValue(false)],
    ["saveImagePyramid",   constValue(false)],
    ["spotColors",         constValue(false)],
    ["transparency",       constValue(true)]
  ]
};

var SAVE_BMP = {
  create: function () { return new BMPSaveOptions(); },
  schema: [
    ["alphaChannels",  constValue(true)],
    ["depth",          constValue(BMPDepthType.BMP_A8R8G8B8)],
    ["rleCompression", booleanValue(true)]
  ]
};


var DELEGATES = {
  saveForWeb: {
    gif: EXPORT_GIF,
    jpg: EXPORT_JPEG,
    png: EXPORT_PNG
  },

  saveAs: {
    bmp: SAVE_BMP,
    gif: SAVE_GIF,
    jpg: SAVE_JPEG,
    png: SAVE_PNG,
    tga: SAVE_TARGA,
    tif: SAVE_TIFF
  }
};


function isNativeSaveOptionsInstance(object) {
  return (
    object instanceof JPEGSaveOptions ||
    object instanceof PNGSaveOptions ||
    object instanceof BMPSaveOptions ||
    object instanceof GIFSaveOptions ||
    object instanceof TargaSaveOptions ||
    object instanceof TiffSaveOptions ||
    object instanceof ExportOptionsSaveForWeb
  );
}


function normalizeFormatKey(format) {
  var key = String(format).toLowerCase();

  switch (key) {
    case "jpeg":
      return "jpg";
    case "targa":
      return "tga";
    case "tiff":
      return "tif";
  }

  return key;
}


function makeInputValue(context, key) {
  var ignored = false;

  return {
    context: context,
    key: key,
    value: context[key],
    isSet: Object.prototype.hasOwnProperty.call(context, key),
    ignore: function () {
      ignored = true;
      return null;
    },
    isIgnored: function () {
      return ignored;
    }
  };
}


function interpretUsing(delegate, object) {
  var nativeObject = delegate.create();

  for (var i = 0; i < delegate.schema.length; i++) {
    var key = delegate.schema[i][0];
    var converter = delegate.schema[i][1];

    var value = makeInputValue(object, key);
    var outputValue = converter(value);

    if (!value.isIgnored()) {
      nativeObject[key] = outputValue;
    }
  }

  return nativeObject;
}


function interpretOptionsMap(options, defaultOptions) {
  var formatKey = normalizeFormatKey(options.format);

  var delegate;
  if (options.web) {
    delegate = DELEGATES.saveForWeb[formatKey];
  }

  if (!delegate) {
    delegate = DELEGATES.saveAs[formatKey];
  }

  if (!delegate) {
    return defaultOptions;
  }

  return interpretUsing(delegate, options);
}


function interpret(options, defaultOptions) {
  if (!options || options === true) {
    return defaultOptions;
  }

  if (isNativeSaveOptionsInstance(options)) {
    return options;
  }

  if (typeof options === "string") {
    return interpretOptionsMap({
      format: options,
      web: true
    }, defaultOptions);
  }

  return interpretOptionsMap(options, defaultOptions);
}


module.exports = {
  interpret: interpret
};
