import { saveFileDialog } from "./lib/fileutil";
import { exportDocument } from "./psd2json";

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

function exportActiveDocumentInteractive() {
  const document = getActiveDocument();
  if (!document) {
    alert("This script requires an open document.");
    return;
  }

  const workingCopy = document.duplicate(
    `${document.name} (psd2json working copy)`,
  );

  const docFile = getDocumentFile(document);
  const suggestedJsonFile = docFile ? proposeJsonFile(docFile) : null;
  const jsonFile = saveFileDialog({
    prompt: `Export ${document.name} to JSON`,
    filter: "JSON files:*.json;All files:*.*",
    initial: suggestedJsonFile,
  });
  if (!jsonFile) return;

  exportDocument({
    document: workingCopy,
    jsonFile,
    verbose: true,
    shouldEnterLayerSet: (l) => l.visible,
    shouldExportLayer: (l) => l.visible,
  });

  workingCopy.close(SaveOptions.DONOTSAVECHANGES);

  alert(`Exported “${document.name}” to “${jsonFile.fsName}”.`);
}

$.global["org_yellcorp_psd2json"] = {
  exportDocument,
  exportActiveDocumentInteractive,
};
