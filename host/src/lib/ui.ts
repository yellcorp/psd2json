import { arrayForEach, arrayReduce } from "./es3";
import { saveFileDialog } from "./fileutil";
import { indexControls } from "./uiutils";

const TEXT_FIELD_WIDTH = 30;

const DIALOG_RESOURCE = `dialog {
  text: 'Export to JSON',
  orientation: 'row',
  alignChildren: 'fill',
  
  grpContent: Group {
    orientation: 'column',
    alignChildren: 'fill',

    pnlExportTo: Panel {
      text: 'Export to',
      orientation: 'column',
      alignChildren: 'fill',
      
      grpJsonFile: Group {
        orientation: 'row',
        alignChildren: 'fill',
        lblJsonFile: StaticText {
          text: 'JSON file',
        },
        edtJsonFile: EditText {
          name: 'edtJsonFile',
          characters: ${TEXT_FIELD_WIDTH},
        },
        btnJsonFile: Button { text: 'Browse…' },
      },

      grpLayerFolder: Group {
        orientation: 'row',
        alignChildren: 'fill',
        lblImageFolderName: StaticText {
          text: 'Layer folder',
        },
        edtImageFolderName: EditText {
          text: 'layers',
          characters: ${TEXT_FIELD_WIDTH},
        },
      },
    },

    pnlInclude: Panel {
      text: 'Include',
      orientation: 'column',
      alignChildren: 'fill',
      
      radVisibleLayers: RadioButton { text: 'Visible layers', value: true },
      radAllLayers: RadioButton { text: 'All layers' },
    }
    
    pnlExportOptions: Panel {
      text: 'Options',
      orientation: 'column',
      alignChildren: 'fill',
      
      cbMergeLayerSets: Checkbox {
        text: 'Merge layer sets',
      },
      
      cbFlattenOpacity: Checkbox {
        text: 'Flatten opacity',
      },
      
      cbOutsideBounds: Checkbox {
        text: 'Include layer content outside the canvas',
      },
    },
  },

  grpTopButtons: Group {
    orientation: 'column',
    btnExport: Button { text: 'Export' },
    btnCancel: Button { text: 'Cancel' },
  },
}`;

function replaceBoundsH(bounds: Bounds, left: number, right: number) {
  const { top, bottom } = bounds;
  return { left, top, right, bottom };
}

export function promptForJsonFile(
  documentName: string,
  suggestedFile: File | null,
) {
  return saveFileDialog({
    prompt: `Export ${documentName} to JSON`,
    filter: "JSON files:*.json;All files:*.*",
    initial: suggestedFile,
  });
}

const enum FileSource {
  FILE_BROWSER,
  TEXT_FIELD,
}

export type AcceptResponse = {
  accept: true;
  jsonFile: File;
  imageFolderName: string;
  includeAllLayers: boolean;
  mergeLayerSets: boolean;
  flattenOpacity: boolean;
  outsideBounds: boolean;
};

export type CancelResponse = {
  accept: false;
};

export type UIResponse = AcceptResponse | CancelResponse;

export function runOptionsDialog(
  documentName: string,
  jsonFile: File | null,
): UIResponse {
  const win = new Window(DIALOG_RESOURCE as any);
  const controlIndex = indexControls(win);

  const btnCancel = controlIndex.btnCancel as Button;
  const btnExport = controlIndex.btnExport as Button;
  const btnJsonFile = controlIndex.btnJsonFile as Button;
  const cbFlattenOpacity = controlIndex.cbFlattenOpacity as Checkbox;
  const cbMergeLayerSets = controlIndex.cbMergeLayerSets as Checkbox;
  const cbOutsideBounds = controlIndex.cbOutsideBounds as Checkbox;
  const edtJsonFile = controlIndex.edtJsonFile as EditText;
  const edtImageFolderName = controlIndex.edtImageFolderName as EditText;
  const radAllLayers = controlIndex.radAllLayers as RadioButton;

  let accept = false;
  let showCount = 0;
  let jsonFileSource = FileSource.FILE_BROWSER;

  function sync() {
    let newFileText: string = "";

    if (jsonFileSource === FileSource.TEXT_FIELD) {
      newFileText = edtJsonFile.text;
      jsonFile = newFileText ? new File(newFileText) : null;
    }

    newFileText = jsonFile ? jsonFile.fsName : "";
    if (newFileText !== edtJsonFile.text) {
      edtJsonFile.text = newFileText;
    }

    btnExport.enabled = jsonFile != null;
  }

  function tweakLayout() {
    // I don't know how to declare a grid layout - I thought setting a
    // consistent `characters` property on the labels would achieve it,
    // but StaticText seems to ignore that property. The problem looks
    // like this:
    //
    //  |  JSON file: [ TextField ] [ Browse… ]  |
    //  |  Layer folder: [ TextField ]           |
    //
    // This code aligns the left and right edges of the text fields.
    // The left edges go to the maximum X, the right edges go to the
    // minimum X.

    const controlsToAlign = [edtJsonFile, edtImageFolderName];

    const [alignedLeft, alignedRight] = arrayReduce(
      controlsToAlign,
      ([accLeft, accRight], ctl) => [
        Math.max(accLeft, ctl.bounds.left ?? -Infinity),
        Math.min(accRight, ctl.bounds.right ?? Infinity),
      ],
      [-Infinity, Infinity],
    );

    if (isFinite(alignedLeft) && isFinite(alignedRight)) {
      arrayForEach(controlsToAlign, (ctl) => {
        // we have to turn this down to allow the control to shrink
        ctl.characters = 1;
        ctl.bounds = replaceBoundsH(
          ctl.bounds,
          alignedLeft,
          alignedRight,
        ) as Bounds;
      });
    }
  }

  function onFirstShow() {
    tweakLayout();
    sync();
  }

  win.onShow = () => {
    if (showCount++ === 0) {
      onFirstShow();
    }
  };

  edtJsonFile.onChange = () => {
    jsonFileSource = FileSource.TEXT_FIELD;
    sync();
  };

  btnJsonFile.onClick = () => {
    const newJsonFile = promptForJsonFile(documentName, jsonFile);
    if (newJsonFile) {
      jsonFile = newJsonFile;
      jsonFileSource = FileSource.FILE_BROWSER;
      sync();
    }
  };

  btnExport.onClick = () => {
    accept = true;
    win.close();
  };

  btnCancel.onClick = () => {
    accept = false;
    win.close();
  };

  win.show();

  return accept && jsonFile
    ? {
        accept: true,
        jsonFile,
        imageFolderName: edtImageFolderName.text,
        includeAllLayers: radAllLayers.value,
        mergeLayerSets: cbMergeLayerSets.value,
        flattenOpacity: cbFlattenOpacity.value,
        outsideBounds: cbOutsideBounds.value,
      }
    : { accept: false };
}
