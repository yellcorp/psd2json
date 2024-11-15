import { arrayForEach, arrayMap } from "./es3";
import { Num2, unitRectAsPixels } from "./geom";
import { sanitizeForFilename } from "./naming";
import { enumName, saveForWeb } from "./psutil";
import { isAnyLocked, LayerSnapshot } from "./snapshot";

export function revealAll(doc: Document): Num2 {
  doc.selection.selectAll();
  doc.revealAll();
  const newBounds = unitRectAsPixels(doc.selection.bounds);
  doc.selection.deselect();

  return [-newBounds[0], -newBounds[1]];
}

export function flattenedTrimmedCopy(
  doc: Document,
  newDocumentName: string,
): { bounds: UnitRect; document: Document } | null {
  const flatDoc = doc.duplicate(newDocumentName, true);
  const bounds = flatDoc.layers[0].bounds;

  if (bounds[0] === bounds[2] || bounds[1] === bounds[3]) {
    flatDoc.close(SaveOptions.DONOTSAVECHANGES);
    return null;
  }

  flatDoc.crop(bounds);
  return {
    document: flatDoc,
    bounds,
  };
}

export function saveLayerDocument(
  ps: Application,
  document: Document,
  imageFolder: Folder,
  nameStem: string,
) {
  const stemParts = nameStem.split(/[\x2f\x5c]/);
  const escapedParts = arrayMap(stemParts, (p) =>
    encodeURIComponent(sanitizeForFilename(p)),
  );

  const imageFile = new File(
    imageFolder.absoluteURI + "/" + escapedParts.join("/") + ".png",
  );
  imageFile.parent.create();
  ps.activeDocument = document;
  saveForWeb(document, imageFile);
  document.close(SaveOptions.DONOTSAVECHANGES);
  return imageFile;
}

export function serializeDocumentProfile(document: Document) {
  if (
    document.colorProfileType === ColorProfile.CUSTOM ||
    document.colorProfileType === ColorProfile.WORKING
  ) {
    return document.colorProfileName;
  }
  return "";
}

export function setLiveVisible(
  layerSnapshot: LayerSnapshot,
  newVisible: boolean,
) {
  layerSnapshot.live.visible = newVisible;

  arrayForEach(layerSnapshot.clippedLayers, (clippedLayer) => {
    if (clippedLayer.visible) {
      clippedLayer.live.visible = clippedLayer.visible && newVisible;
    }
  });
}

export function showAndUnlockLayer(layerSnapshot: LayerSnapshot) {
  setLiveVisible(layerSnapshot, true);
  if (isAnyLocked(layerSnapshot)) {
    layerSnapshot.live.allLocked = false;
  }
}

export function makeFullyOpaque(layerSnapshot: LayerSnapshot) {
  if (layerSnapshot.opacity < 100) {
    layerSnapshot.live.opacity = 100;
  }

  if (
    layerSnapshot.typename === "ArtLayer" &&
    layerSnapshot.fillOpacity < 100
  ) {
    layerSnapshot.live.fillOpacity = 100;
  }
}

export function isTraversableLayerSet(layerSnapshot: LayerSnapshot) {
  // TODO: there was an old comment reading '!hasLayerEffects'. The
  //  reasoning must be that if a folder having layer effects isn't
  //  flattened, there's no way to preserve the appearance of those
  //  effects, because they're not backed by an art layer. A quick
  //  glance shows no mention of layer effects in snapshot.js, so that
  //  must be blocking it. Probably an ActionManager thing if the API
  //  reference doesn't mention it.
  return (
    layerSnapshot.typename === "LayerSet" &&
    layerSnapshot.clippedLayers.length === 0
  );
}

export function serializeLayerCommon(layerSnapshot: LayerSnapshot) {
  return {
    name: layerSnapshot.name,
    index: layerSnapshot.index,
    namePath: layerSnapshot.namePath.slice(),
    indexPath: layerSnapshot.indexPath.slice(),
    blendMode: enumName(layerSnapshot.live.blendMode),
    set: false,
  };
}
