import { arrayContains, arrayMap } from "./es3";

export type CommonSnapshotTraits = {
  name: string;
  depth: number;
  index: number;
  namePath: string[];
  indexPath: number[];
};

export type ContainerSnapshotTraits = {
  layers: LayerSnapshot[];
};

export type LayerSnapshotTraits = {
  parent: ContainerSnapshot;
  document: DocumentSnapshot;
  clippedLayers: ArtLayerSnapshot[];
  visible: boolean;
  opacity: number;
  allLocked: boolean;
};

export type DocumentSnapshot = CommonSnapshotTraits &
  ContainerSnapshotTraits & {
    typename: "Document";
    live: Document;
  };

export function takeDocumentSnapshot(live: Document): DocumentSnapshot {
  return {
    typename: "Document",
    live,
    name: live.name,
    depth: 0,
    index: 0,
    namePath: [],
    indexPath: [],
    layers: [],
  };
}

function getCommonLayerSnapshotTraits(
  live: LayerSet | ArtLayer,
  parent: ContainerSnapshot,
  document: DocumentSnapshot,
  index: number,
): CommonSnapshotTraits & LayerSnapshotTraits {
  return {
    name: live.name,
    depth: parent.depth + 1,
    index,
    namePath: parent.namePath.concat([live.name]),
    indexPath: parent.indexPath.concat([index]),
    parent,
    document,
    clippedLayers: [],
    visible: live.visible,
    opacity: live.opacity,
    allLocked: live.allLocked,
  };
}

export type LayerSetSnapshot = CommonSnapshotTraits &
  ContainerSnapshotTraits &
  LayerSnapshotTraits & {
    typename: "LayerSet";
    live: LayerSet;
  };

export function takeLayerSetSnapshot(
  live: LayerSet,
  parent: ContainerSnapshot,
  document: DocumentSnapshot,
  index: number,
): LayerSetSnapshot {
  return {
    typename: "LayerSet",
    live,
    ...getCommonLayerSnapshotTraits(live, parent, document, index),
    layers: [],
  };
}

export type ArtLayerSnapshot = CommonSnapshotTraits &
  LayerSnapshotTraits & {
    typename: "ArtLayer";
    live: ArtLayer;
    grouped: boolean;
    clippedBy: LayerSnapshot | null;
    fillOpacity: number;
    kind: LayerKind;
    pixelsLocked: boolean;
    positionLocked: boolean;
    transparentPixelsLocked: boolean;
  };

export function takeArtLayerSnapshot(
  live: ArtLayer,
  parent: ContainerSnapshot,
  document: DocumentSnapshot,
  index: number,
): ArtLayerSnapshot {
  return {
    typename: "ArtLayer",
    live,
    ...getCommonLayerSnapshotTraits(live, parent, document, index),
    grouped: live.grouped,
    clippedBy: null,
    fillOpacity: live.fillOpacity,
    kind: live.kind,
    pixelsLocked: live.pixelsLocked,
    positionLocked: live.positionLocked,
    transparentPixelsLocked: live.transparentPixelsLocked,
  };
}

export type ContainerSnapshot = LayerSetSnapshot | DocumentSnapshot;
export type LayerSnapshot = LayerSetSnapshot | ArtLayerSnapshot;
export type Snapshot = DocumentSnapshot | LayerSetSnapshot | ArtLayerSnapshot;

function takeLayerSnapshot(
  liveLayer: Layer,
  parent: ContainerSnapshot,
  document: DocumentSnapshot,
  index: number,
) {
  switch (liveLayer.typename) {
    case "ArtLayer":
      return takeArtLayerSnapshot(
        liveLayer as ArtLayer,
        parent,
        document,
        index,
      );
    case "LayerSet":
      return takeLayerSetSnapshot(
        liveLayer as LayerSet,
        parent,
        document,
        index,
      );
  }
  throw new Error(`Assert: unsupported layer typename ${liveLayer.typename}`);
}

// Prep

export function populateContainerSnapshot(
  container: ContainerSnapshot,
  document: DocumentSnapshot,
) {
  const childSnapshots = (container.layers = arrayMap(
    container.live.layers,
    (liveLayer, index) =>
      takeLayerSnapshot(liveLayer, container, document, index),
  ));

  // populate clipping relationships. this is exposed via the Photoshop
  // API as the `grouped` boolean property. When true, the layer's
  // transparency is intersected with the transparency of the next
  // non-grouped layer underneath (in a higher index).
  let clipperCandidate: LayerSnapshot | null = null;
  for (let i = childSnapshots.length - 1; i >= 0; i--) {
    const childSnapshot = childSnapshots[i];
    if (
      childSnapshot.typename === "ArtLayer" &&
      childSnapshot.grouped &&
      clipperCandidate
    ) {
      childSnapshot.clippedBy = clipperCandidate;
      clipperCandidate.clippedLayers.unshift(childSnapshot);
    } else {
      clipperCandidate = childSnapshot;
    }
  }
}

// Queries

export function isAnyLocked(layerSnapshot: LayerSnapshot): boolean {
  switch (layerSnapshot.typename) {
    case "LayerSet":
      return layerSnapshot.allLocked;
    case "ArtLayer":
      return (
        layerSnapshot.allLocked ||
        layerSnapshot.pixelsLocked ||
        layerSnapshot.positionLocked ||
        layerSnapshot.transparentPixelsLocked
      );
  }
}

export function isArtLayerOfAnyKind(
  snapshot: ArtLayerSnapshot,
  kinds: ReadonlyArray<LayerKind>,
) {
  return arrayContains(kinds, snapshot.kind);
}

export function isSmartObject(snapshot: ArtLayerSnapshot) {
  return snapshot.kind === LayerKind.SMARTOBJECT;
}

export function isTextLayer(snapshot: ArtLayerSnapshot) {
  return snapshot.kind === LayerKind.TEXT;
}

export function is3DLayer(snapshot: ArtLayerSnapshot) {
  return snapshot.kind === LayerKind.LAYER3D;
}

export function isVideoLayer(snapshot: ArtLayerSnapshot) {
  return snapshot.kind === LayerKind.VIDEO;
}

const IMAGE_LAYER_KINDS = [LayerKind.NORMAL, LayerKind.SMARTOBJECT];

export function isImageLayer(snapshot: ArtLayerSnapshot) {
  return isArtLayerOfAnyKind(snapshot, IMAGE_LAYER_KINDS);
}

const FILL_LAYER_KINDS = [
  LayerKind.GRADIENTFILL,
  LayerKind.PATTERNFILL,
  LayerKind.SOLIDFILL,
];

export function isFillLayer(snapshot: ArtLayerSnapshot) {
  return isArtLayerOfAnyKind(snapshot, FILL_LAYER_KINDS);
}

const ADJUSTMENT_LAYER_KINDS = [
  LayerKind.BLACKANDWHITE,
  LayerKind.BRIGHTNESSCONTRAST,
  LayerKind.CHANNELMIXER,
  LayerKind.COLORBALANCE,
  LayerKind.CURVES,
  LayerKind.EXPOSURE,
  LayerKind.GRADIENTMAP,
  LayerKind.HUESATURATION,
  LayerKind.INVERSION,
  LayerKind.LEVELS,
  LayerKind.PHOTOFILTER,
  LayerKind.POSTERIZE,
  LayerKind.SELECTIVECOLOR,
  LayerKind.THRESHOLD,
  LayerKind.VIBRANCE,
];

export function isAdjustmentLayer(layerSnapshot: ArtLayerSnapshot) {
  return isArtLayerOfAnyKind(layerSnapshot, ADJUSTMENT_LAYER_KINDS);
}
