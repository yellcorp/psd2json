import { generateTempFile, rename } from "./fileutil";

export function enumName(enumValue: any) {
  const asString = String(enumValue);
  const dot = asString.indexOf(".");
  return dot === -1 ? asString : asString.substring(dot + 1);
}

function defaultSaveForWebOptions() {
  const opts = new ExportOptionsSaveForWeb();
  opts.blur = 0;
  opts.includeProfile = true;
  opts.interlaced = false;
  opts.transparency = true;
  opts.format = SaveDocumentType.PNG;
  opts.PNG8 = false;
  return opts;
}

function fileSuffixForSaveForWebOptions(options: ExportOptionsSaveForWeb) {
  switch (options.format) {
    case SaveDocumentType.JPEG:
      return ".jpg";
    case SaveDocumentType.COMPUSERVEGIF:
      return ".gif";
    case SaveDocumentType.PNG:
      return ".png";
  }
  return "";
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
export function saveForWeb(
  document: Document,
  outFile: File,
  options?: ExportOptionsSaveForWeb,
) {
  if (!options) options = defaultSaveForWebOptions();
  const suffix = fileSuffixForSaveForWebOptions(options);

  const outFolder = outFile.parent;
  const outName = outFile.name;

  const newTempFile = generateTempFile(outFolder, "", suffix);
  document.exportDocument(newTempFile, ExportType.SAVEFORWEB, options);

  let oldTempFile: File | null = null;
  if (outFile.exists) {
    const temp = generateTempFile(outFolder, outName, "");
    oldTempFile = rename(outFile, temp.name);
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
            String(rollbackError),
        );
      }
    }
    throw renameError;
  }

  if (oldTempFile) {
    oldTempFile.remove();
  }
}
