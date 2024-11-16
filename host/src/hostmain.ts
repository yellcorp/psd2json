import { arrayFilter, arrayMap } from "./lib/es3";
import { saveFileDialog } from "./lib/fileutil";
import { runOptionsDialog } from "./lib/ui";
import { exportDocument, LayerPredicate } from "./psd2json";

function getActiveDocument() {
  try {
    return app.activeDocument;
  } catch (getDocError) {
    return null;
  }
}

function getDocumentFile(doc: Document) {
  try {
    return doc.fullName;
  } catch (getDocFileError) {
    return null;
  }
}

function proposeJsonFile(psdPath: File) {
  const uriParts = psdPath.absoluteURI.split("/");
  const leaf = uriParts.pop()!;
  const leafParts = leaf.split(".");
  if (leafParts.length >= 2) {
    leafParts.pop();
  }
  leafParts.push("json");
  uriParts.push(leafParts.join("."));
  return new File(uriParts.join("/"));
}

function makeEnterLayerSetPredicate(
  mergeLayerSets: boolean,
  includeAllLayers: boolean,
): LayerPredicate {
  if (mergeLayerSets) {
    return (_) => false;
  }

  if (includeAllLayers) {
    return (_) => true;
  }

  return (l) => l.visible;
}

function makeExportLayerPredicate(includeAllLayers: boolean): LayerPredicate {
  if (includeAllLayers) {
    return (_) => true;
  }

  return (l) => l.visible;
}

function interpretImageFolder(jsonFile: File, imageFolderName: string): Folder {
  if (!imageFolderName) {
    return jsonFile.parent;
  }
  const pathParts = arrayFilter(
    imageFolderName.split(/[\x2F\x5C]/g),
    (p) => p.length > 0,
  );
  const escapedParts = arrayMap(pathParts, (p) => encodeURIComponent(p));
  return new Folder(jsonFile.parent.absoluteURI + "/" + escapedParts.join("/"));
}

function exportActiveDocumentInteractive() {
  const document = getActiveDocument();
  if (!document) {
    alert("This script requires an open document.");
    return;
  }

  const docFile = getDocumentFile(document);
  const suggestedJsonFile = docFile ? proposeJsonFile(docFile) : null;
  const initialJsonFile = saveFileDialog({
    prompt: `Export ${document.name} to JSON`,
    filter: "JSON files:*.json;All files:*.*",
    initial: suggestedJsonFile,
  });
  if (!initialJsonFile) return;

  const uiResponse = runOptionsDialog(document.name, initialJsonFile);
  if (!uiResponse.accept) return;

  const workingCopy = document.duplicate(
    `${document.name} (psd2json working copy)`,
  );

  const {
    jsonFile,
    imageFolderName,
    includeAllLayers,
    mergeLayerSets,
    flattenOpacity,
    outsideBounds,
  } = uiResponse;

  const imageFolder = interpretImageFolder(jsonFile, imageFolderName);

  exportDocument({
    document: workingCopy,
    jsonFile,
    imageFolder,
    flattenOpacity,
    outsideBounds,
    verbose: true,
    shouldEnterLayerSet: makeEnterLayerSetPredicate(
      mergeLayerSets,
      includeAllLayers,
    ),
    shouldExportLayer: makeExportLayerPredicate(includeAllLayers),
  });

  workingCopy.close(SaveOptions.DONOTSAVECHANGES);

  alert(`Exported “${document.name}” to “${jsonFile.fsName}”.`);
}

function testDialog() {
  const ret = runOptionsDialog("EXAMPLE", new File("example.json"));
  alert(uneval(ret));
}

$.global["org_yellcorp_psd2json"] = {
  exportDocument,
  exportActiveDocumentInteractive,
  testDialog,
};
