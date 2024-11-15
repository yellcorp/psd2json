import { jsonStringify } from "./jsonutil";

function getFsMessage(file: unknown): string | undefined {
  if (
    file != null &&
    typeof file === "object" &&
    "fsMessage" in file &&
    typeof file.fsMessage === "string"
  ) {
    return file.fsMessage;
  }
  return undefined;
}

function errorForFile(file: File, operationName: string) {
  let message = "File error";
  if (operationName) {
    message += `: ${operationName}`;
  }

  const fsMessage = getFsMessage(file);
  if (fsMessage) {
    message += ` (${fsMessage})`;
  }

  const error: any = new Error(message);
  error.fsMessage = fsMessage || "<unspecified>";
  error.file = file;
  return error;
}

export function throwIfFail(
  file: File,
  success: boolean,
  operationName: string,
) {
  if (!success) {
    throw errorForFile(file, operationName);
  }
}

export function rename(src: File, newName: string): File {
  const work = new File(src.absoluteURI);
  throwIfFail(work, work.rename(newName), "rename");
  return work;
}

export function writeText(outFile: File, content: string) {
  throwIfFail(outFile, outFile.open("w"), "open");
  if (outFile.lineFeed.toLowerCase() === "macintosh") {
    // ExtendScript still thinks we're on MacOS Classic and
    // uses CR line endings by default. Change it to LF.
    outFile.lineFeed = "Unix";
  }
  outFile.encoding = "UTF-8";
  outFile.write(content);
  throwIfFail(outFile, outFile.close(), "close");
}

export function writeJson(outFile: File, objectGraph: any, indent?: string) {
  writeText(outFile, jsonStringify(objectGraph, indent));
}

const RANDOM_STRING_CHARS = "0123456789abcdefghjkmnpqrstvwxyz";

function randomString(length: number): string {
  let s = "";
  for (let i = 0; i < length; i++) {
    const pick = Math.floor(Math.random() * RANDOM_STRING_CHARS.length);
    s += RANDOM_STRING_CHARS.charAt(pick);
  }
  return s;
}

export function generateTempFile(
  folder: Folder,
  prefix: string,
  suffix: string,
): File {
  for (let i = 0; i < 1000; i++) {
    const proposedFilename = prefix + randomString(25) + suffix;
    const tempFile = new File(folder.absoluteURI + "/" + proposedFilename);
    if (!tempFile.exists) {
      return tempFile;
    }
  }
  throw new Error("Assert: generateTempFile: Too many attempts");
}

export function saveFileDialog(params?: {
  prompt?: string | undefined;
  filter?: string | undefined;
  initial?: File | null | undefined;
}): File | null {
  const { prompt, filter, initial } = params || {};
  return initial
    ? initial.saveDlg(prompt, filter)
    : File.saveDialog(prompt, filter);
}
