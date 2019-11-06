/*global
  $,
  RGBColor,
  SolidColor
*/
"use strict";


var psutil = require("../psutil");
var normalizeWebColorString = require("./misc").normalizeWebColorString;


function constValue(value) {
  return function (_unusedInput) {
    return value;
  };
}


function booleanValue(defaultValue) {
  return function (input) {
    return Boolean(input.isSet ? input.value : defaultValue);
  };
}


function finitePositiveNumber(defaultValue) {
  return function (input) {
    return (
      input.isSet &&
      isFinite(input.value) &&
      input.value >= 0
    ) ? Number(input.value) : defaultValue;
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


function interpretEmbedColorProfile(input) {
  return Boolean(
    input.context.embedColorProfile ||
    input.context.includeProfile
  );
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
          "Error: Couldn't interpret " + input.value +
          " as a member of enum " + enumClass
        );
        throw error;
      }
    }

    return defaultValue;
  };
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

    var asHex = normalizeWebColorString(input.value);
    if (asHex) {
      color = new RGBColor();
      color.hexValue = asHex;
      return color;
    }
  }

  return input.ignore();
}


module.exports = {
  constValue: constValue,
  booleanValue: booleanValue,
  finitePositiveNumber: finitePositiveNumber,
  intInRange: intInRange,
  scaleToIntRange: scaleToIntRange,
  interpretEmbedColorProfile: interpretEmbedColorProfile,
  enumValue: enumValue,
  rgbColor: rgbColor,
};
