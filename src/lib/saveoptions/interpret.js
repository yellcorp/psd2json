/*global
  BMPSaveOptions,
  ExportOptionsSaveForWeb,
  GIFSaveOptions,
  JPEGSaveOptions,
  PNGSaveOptions,
  TargaSaveOptions,
  TiffSaveOptions,
 */
"use strict";


var delegates = require("./delegates");


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
  var delegate = options.web ?
    delegates.getExporter(options.format) :
    delegates.getSaver(options.format);

  if (!delegate) {
    return defaultOptions;
  }

  return interpretUsing(delegate, options);
}


function interpretSaveOptions(options, defaultOptions) {
  if (!options || options === true) {
    return defaultOptions;
  }

  if (isNativeSaveOptionsInstance(options)) {
    return options;
  }

  if (typeof options === "string") {
    return interpretOptionsMap(
      {
        format: options,
        web: true
      },
      defaultOptions
    );
  }

  return interpretOptionsMap(options, defaultOptions);
}


exports.interpretSaveOptions = interpretSaveOptions;
