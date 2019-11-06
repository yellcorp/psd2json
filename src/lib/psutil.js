/*global
  $,
  BMPSaveOptions,
  EPSSaveOptions,
  ExportOptionsSaveForWeb,
  ExportType,
  File,
  GIFSaveOptions,
  JPEGSaveOptions,
  PDFSaveOptions,
  PNGSaveOptions,
  PhotoshopSaveOptions,
  SaveDocumentType,
  TargaSaveOptions,
  TiffSaveOptions,
*/
"use strict";


var fileutil = require("../xslib/fileutil");


function enumName(enumValue) {
  var asString = String(enumValue);
  var dot = asString.indexOf(".");
  return dot >= 0 ? asString.substring(dot + 1) : asString;
}


function fileSuffixForSaveType(saveDocumentType) {
  switch (saveDocumentType) {
    case SaveDocumentType.BMP:
      return ".bmp";
    case SaveDocumentType.COMPUSERVEGIF:
      return ".gif";
    case SaveDocumentType.JPEG:
      return ".jpg";
    case SaveDocumentType.PNG:
      return ".png";
    }
  return null;
}


function fileSuffixForSaveForWebOptions(options) {
  return fileSuffixForSaveType(options.format);
}


var CTOR_TO_SUFFIX = [
  [BMPSaveOptions,       ".bmp"],
  [EPSSaveOptions,       ".eps"],
  [GIFSaveOptions,       ".gif"],
  [JPEGSaveOptions,      ".jpg"],
  [PDFSaveOptions,       ".pdf"],
  [PhotoshopSaveOptions, ".psd"],
  [PNGSaveOptions,       ".png"],
  [TargaSaveOptions,     ".tga"],
  [TiffSaveOptions,      ".tif"]
];
function fileSuffixForSaveOptions(saveOptions) {
  if (saveOptions instanceof ExportOptionsSaveForWeb) {
    return fileSuffixForSaveForWebOptions(saveOptions);
  }

  for (var i = 0; i < CTOR_TO_SUFFIX.length; i++) {
    if (saveOptions instanceof CTOR_TO_SUFFIX[i][0]) {
      return CTOR_TO_SUFFIX[i][1];
    }
  }

  return null;
}


function isExistentFile(file) {
  var fsObject = File(file.absoluteURI);
  return fsObject instanceof File && fsObject.exists;
}


function rename(file, newName) {
  fileutil.throwIfFail(file, file.rename(newName), "rename");
}


function _saveForWeb(document, outFile, options) {
  var suffix = fileSuffixForSaveForWebOptions(options);

  var outFolder = outFile.parent;
  var outName = outFile.name;

  var newTempFile = fileutil.generateTempFile(outFolder, "", suffix);
  document.exportDocument(newTempFile, ExportType.SAVEFORWEB, options);

  var oldTempFile = null;
  if (isExistentFile(outFile)) {
    oldTempFile = fileutil.generateTempFile(outFolder, outName, "");
    rename(outFile, oldTempFile.name);
  }

  try {
    rename(newTempFile, outName);
  } catch (renameError) {
    if (oldTempFile) {
      try {
        rename(oldTempFile, outName);
      } catch (rollbackError) {
        $.writeln(
          "Warning: Rollback failed: Could not revert name of `" +
          oldTempFile.fsName +
          "` to `" +
          outName +
          "`: " +
          String(rollbackError)
        );
      }
    }
    throw renameError;
  }

  if (oldTempFile) {
    oldTempFile.remove();
  }
}


/**
 * Perform a Save for Web export.
 *
 * This is the same as Document.exportDocument() with the exportAs argument set
 * to ExportType.SAVEFORWEB, except this function guarantees the specified
 * filename is the one used. Document.exportDocument() can apply
 * transformations to the filename, which are customizable in the Save For Web
 * UI. The API offers no way of reliably retrieving the transformed name.
 *
 * This workaround first saves to a file with a cross-platform-compatible
 * temporary name, then renames it to the specified filename.
 */
function saveForWeb(document, exportIn, options) {
  if (!(options instanceof ExportOptionsSaveForWeb)) {
    throw new Error("options must be an instance of ExportOptionsSaveForWeb");
  }

  // The various rename operations changes the passed-in file object, so work
  // with a copy.
  _saveForWeb(document, File(exportIn.absoluteURI), options);
}


exports.enumName = enumName;
exports.fileSuffixForSaveOptions = fileSuffixForSaveOptions;
exports.saveForWeb = saveForWeb;
