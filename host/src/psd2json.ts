import { arrayForEach } from "./lib/es3";
import {
  flattenedTrimmedCopy,
  isTraversableLayerSet,
  makeFullyOpaque,
  revealAll,
  saveLayerDocument,
  serializeDocumentProfile,
  serializeLayerCommon,
  setLiveVisible,
  showAndUnlockLayer,
} from "./lib/exporthelpers";
import { writeJson } from "./lib/fileutil";
import {
  Num2,
  NumericBounds,
  translateNumericBounds,
  unitRectAsPixels,
  unitValueAsPixels,
} from "./lib/geom";
import { notNull } from "./lib/langutil";
import { makeFilenameGenerator } from "./lib/naming";
import {
  ContainerSnapshot,
  DocumentSnapshot,
  isTextLayer,
  LayerSnapshot,
  populateContainerSnapshot,
  takeDocumentSnapshot,
} from "./lib/snapshot";

export type LayerPredicate = (layer: LayerSnapshot) => boolean;

export const isLayerVisible: LayerPredicate = (layer) => layer.visible;

export interface PSD2JSONExportOptions {
  /**
   * The document to export. The document to export. If this is a string
   * or File object, it will be opened (or foregrounded if already
   * open).
   */
  document: string | File | Document;

  /**
   * The path of the output JSON metadata.
   */
  jsonFile: string | File;

  /**
   * The root folder to contain layer image files. The default is the
   * same folder as the JSON file.
   */
  imageFolder?: string | Folder | undefined | null;

  /**
   * Whether to flatten layer opacity.
   * If `true` (the default), layers will be exported at their current
   * opacity. For example, a layer set to 25% opacity, containing
   * fully-opaque pixels, will appear 25% opaque in the exported PNG.
   * If `false`, layers will have their opacity temporarily set to 100%
   * before exporting, and their original opacity will appear in the
   * JSON file under an `opacity` property, in the range 0-100.
   */
  flattenOpacity?: boolean | undefined | null;

  /**
   * Whether to export the entirety of layers that fall outside the
   * document canvas.
   * If `false` (the default), layers that are partially outside the
   * document canvas will be cropped to the document edges, and layers
   * that are wholly outside the canvas will be skipped.
   * If `true`, all layers will be exported fully. This is achieved by
   * executing Image > Reveal All, though layer coordinates use the top
   * left of the original document as its origin. This means that layer
   * bounds can be negative in this mode.
   */
  outsideBounds?: boolean | undefined | null;

  /**
   * If `true`, log progress information to the Debug Console. The
   * default is `false`.
   */
  verbose?: boolean | undefined | null;

  /**
   * A `LayerPredicate` that decides whether a layer set should have
   * its contents exported individually. When a layer set is
   * encountered, a `LayerSnapshot` of it is passed to this callback,
   * and its return value is used.
   * If the callback returns `true`, its contents will be individually
   * considered for export.
   * If `false`, the layer set is considered to be a flat layer, and is
   * then passed to `shouldExportLayer` (see next).
   * The values `true` or `false` can also be used here instead of a
   * function, and that value will be used for all layer sets.
   * The default is `false`, meaning all layer sets are flattened.
   */
  shouldEnterLayerSet?: boolean | LayerPredicate | undefined | null;

  /**
   * A `LayerPredicate` that decides whether a layer should be saved to
   * a PNG.
   * If the callback returns `false`, the layer is skipped - it will not
   * be exported to an image and it won't appear in the JSON metadata.
   * If the callback returns `true`, the layer will appear in the JSON
   * metadata and be exported as a PNG with transparency.
   * The values `true` or `false` values can also be used here instead
   * of a function, and that value will be used for all layers - though
   * note that `false` will cause no layers to be exported, so has
   * limited use.  The default is a function that exports only visible
   * layers.
   */
  shouldExportLayer?: boolean | LayerPredicate | undefined | null;
}

function validateJsonFile(jsonFile: string | File): File {
  if (typeof jsonFile === "string") {
    if (!jsonFile) {
      throw new Error("JSON file path is empty.");
    }
    return new File(jsonFile);
  }
  return jsonFile;
}

function validateImageFolder(
  imageFolder: string | Folder | undefined | null,
  defaultValue: Folder,
): Folder {
  if (!imageFolder) {
    return defaultValue;
  }

  if (typeof imageFolder === "string") {
    return new Folder(imageFolder);
  }

  return imageFolder;
}

function makeConstFunc(constValue: boolean): LayerPredicate {
  return function (_ignored: LayerSnapshot) {
    return constValue;
  };
}

function validateLayerPredicate(
  predicate: boolean | LayerPredicate | undefined | null,
  defaultValue: boolean | LayerPredicate,
): LayerPredicate {
  if (predicate == null) {
    predicate = defaultValue;
  }

  if (typeof predicate === "boolean") {
    return makeConstFunc(predicate);
  }

  return predicate;
}

function callWithoutThis<P, R>(theFunction: (param: P) => R, param: P): R {
  return theFunction(param);
}

function extendScriptLog(text: string) {
  $.write(text);
}

function acquireDocument(
  ps: Application,
  document: string | File | Document,
): Document {
  if (typeof document === "string") {
    document = new File(document);
  }

  if (document instanceof File) {
    return ps.open(document);
  }

  return document;
}

export interface DocumentMetadataExportOptions {
  flattenOpacity: boolean;
  outsideBounds: boolean;
}

export interface TextMetadata {
  contents: string;
}

export interface LayerMetadata {
  name: string;
  index: number;
  namePath: string[];
  indexPath: number[];
  blendMode: string;
  opacity?: number;
  fillOpacity?: number;
  set: boolean;
  layers?: LayerMetadata[];
  text?: TextMetadata;
  empty?: boolean;
  path?: string | null;
  bounds?: NumericBounds;
}

export interface DocumentMetadata {
  profile: string;
  name: string;
  size: Num2;
  layers: LayerMetadata[];
  options: DocumentMetadataExportOptions;
}

const GLYPH_OKLF = " \u2713\n";
const GLYPH_SKIP = "\u2205 ";
const GLYPH_ENTER = "\u21B3 ";
const GLYPH_EXPORT = "\u2022 ";
const GLYPH_TITLE_SEPARATOR = " \u2023 ";
const LOG_INDENT = "  ";

function documentNameForLayer(layerSnapshot: LayerSnapshot): string {
  const name =
    "Flattened copy of " +
    layerSnapshot.document.name +
    GLYPH_TITLE_SEPARATOR +
    layerSnapshot.namePath.join(GLYPH_TITLE_SEPARATOR);

  return name.replace(/:/g, ";");
}

class Exporter {
  private globalBoundsTranslation: Num2 = [NaN, NaN];
  private documentSnapshot: DocumentSnapshot | null = null;

  constructor(
    public readonly ps: Application,
    public readonly document: Document,
    public readonly jsonFile: File,
    public readonly imageFolder: Folder,
    public readonly flattenOpacity: boolean,
    public readonly outsideBounds: boolean,
    public readonly shouldEnterLayerSet: LayerPredicate,
    public readonly shouldExportLayer: LayerPredicate,
    public readonly filenameGenerator: (layer: LayerSnapshot) => string,
    public readonly logFunction: ((text: string) => void) | null,
  ) {}

  public run() {
    this.ps.activeDocument = this.document;
    this.documentSnapshot = takeDocumentSnapshot(this.document);
    this.jsonFile.parent.create();

    this.log(`Starting psd2json export of document ${this.document.name}`);

    const outJson: DocumentMetadata = {
      profile: serializeDocumentProfile(this.document),
      name: this.document.name,
      size: [
        unitValueAsPixels(this.document.width),
        unitValueAsPixels(this.document.height),
      ],
      layers: [],
      options: {
        flattenOpacity: this.flattenOpacity,
        outsideBounds: this.outsideBounds,
      },
    };

    this.globalBoundsTranslation = this.outsideBounds
      ? revealAll(this.document)
      : [0, 0];

    this.traverseContainer(notNull(this.documentSnapshot), outJson.layers, "");

    writeJson(this.jsonFile, outJson, " ");

    this.log(`Completed psd2json with document ${this.document.name}\n`);
  }

  private traverseContainer(
    containerSnapshot: ContainerSnapshot,
    targetExportArray: LayerMetadata[],
    logIndent: string,
  ) {
    populateContainerSnapshot(
      containerSnapshot,
      notNull(this.documentSnapshot),
    );

    this.log(GLYPH_OKLF);

    arrayForEach(containerSnapshot.layers, (layerSnapshot) => {
      if (layerSnapshot.visible) {
        layerSnapshot.live.visible = false;
      }
    });

    arrayForEach(containerSnapshot.layers, (layerSnapshot) => {
      this.processLayer(layerSnapshot, targetExportArray, logIndent);
    });

    if (containerSnapshot.typename !== "Document") {
      setLiveVisible(containerSnapshot, false);
    }
  }

  private processLayer(
    layerSnapshot: LayerSnapshot,
    targetExportLayers: LayerMetadata[],
    logIndent: string,
  ) {
    const enterLayer =
      isTraversableLayerSet(layerSnapshot) &&
      callWithoutThis(this.shouldEnterLayerSet, layerSnapshot);

    const exportLayer =
      !enterLayer && callWithoutThis(this.shouldExportLayer, layerSnapshot);
    const skipLayer = !enterLayer && !exportLayer;

    if (skipLayer) {
      this.log(`${logIndent + GLYPH_SKIP + layerSnapshot.name}\n`);
      return;
    }

    showAndUnlockLayer(layerSnapshot);
    const layerMetadata: LayerMetadata = serializeLayerCommon(layerSnapshot);

    if (!this.flattenOpacity) {
      layerMetadata.opacity = layerSnapshot.opacity;
      if (layerSnapshot.typename === "ArtLayer") {
        layerMetadata.fillOpacity = layerSnapshot.fillOpacity;
      }
      makeFullyOpaque(layerSnapshot);
    }

    if (enterLayer) {
      if (layerSnapshot.typename !== "LayerSet") {
        throw new Error(
          `Assert: enterLayer is true but typename is "${layerSnapshot.typename}"`,
        );
      }

      this.log(`${logIndent}${GLYPH_ENTER}${layerSnapshot.name}`);

      targetExportLayers.unshift(layerMetadata);
      layerMetadata.set = true;
      layerMetadata.layers = [];

      this.traverseContainer(
        layerSnapshot,
        layerMetadata.layers,
        logIndent + LOG_INDENT,
      );
    } else if (exportLayer) {
      this.log(logIndent + GLYPH_EXPORT + layerSnapshot.name);

      targetExportLayers.unshift(layerMetadata);
      this.exportLayer(layerSnapshot, layerMetadata);
      setLiveVisible(layerSnapshot, false);

      this.log(GLYPH_OKLF);
    }
  }

  private exportLayer(
    layerSnapshot: LayerSnapshot,
    targetExportLayer: LayerMetadata,
  ) {
    if (layerSnapshot.typename === "ArtLayer" && isTextLayer(layerSnapshot)) {
      targetExportLayer.text = {
        contents: layerSnapshot.live.textItem.contents,
      };
    }

    const isolatedLayer = flattenedTrimmedCopy(
      this.document,
      documentNameForLayer(layerSnapshot),
    );

    if (!isolatedLayer) {
      targetExportLayer.empty = true;
      targetExportLayer.path = null;
      targetExportLayer.bounds = [0, 0, 0, 0];
      return;
    }

    targetExportLayer.empty = false;
    const filename = callWithoutThis(this.filenameGenerator, layerSnapshot);
    const savedFile = saveLayerDocument(
      this.ps,
      isolatedLayer.document,
      this.imageFolder,
      filename,
    );
    this.ps.activeDocument = this.document;

    const savedFileRel = savedFile.getRelativeURI(
      this.jsonFile.parent.absoluteURI,
    );
    targetExportLayer.path = decodeURIComponent(savedFileRel);
    targetExportLayer.bounds = translateNumericBounds(
      unitRectAsPixels(isolatedLayer.bounds),
      this.globalBoundsTranslation,
    );
  }

  private log(text: string) {
    const logFunction = this.logFunction;
    if (logFunction) logFunction(text);
  }
}

/**
 * Exports a Photoshop document's layers as PNG files + JSON metadata.
 *
 * @param params Options controlling the export.
 */
export function exportDocument(params: PSD2JSONExportOptions) {
  const jsonFile = validateJsonFile(params.jsonFile);
  const imageFolder = validateImageFolder(params.imageFolder, jsonFile.parent);

  const flattenOpacity = params.flattenOpacity !== false;
  const outsideBounds = !!params.outsideBounds;
  const shouldEnterLayerSet = validateLayerPredicate(
    params.shouldEnterLayerSet,
    false,
  );
  const shouldExportLayer = validateLayerPredicate(
    params.shouldExportLayer,
    isLayerVisible,
  );
  const logFunction = params.verbose ? extendScriptLog : null;

  const document = acquireDocument(app, params.document);

  const exporter = new Exporter(
    app,
    document,
    jsonFile,
    imageFolder,
    flattenOpacity,
    outsideBounds,
    shouldEnterLayerSet,
    shouldExportLayer,
    makeFilenameGenerator(),
    logFunction,
  );

  exporter.run();
}
