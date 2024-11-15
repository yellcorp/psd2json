import { arrayReduce, trim } from "./es3";
import { hashInteger, hashToHexString, initHash } from "./fnvhash";
import { LayerSnapshot } from "./snapshot";

export function makeFilenameGenerator() {
  const YES = {};
  const seenNames: Record<string, typeof YES> = {};

  function generateFilename(layerSnapshot: LayerSnapshot): string {
    let hash = arrayReduce(
      layerSnapshot.indexPath,
      (h, i) => hashInteger(h, i, 2),
      initHash(),
    );

    const slug = trim(
      layerSnapshot.name
        .toLowerCase()
        .slice(0, 50)
        .replace(/[\/\\]/g, "_"),
    );

    let name = "";
    let bumper = 0x55;
    do {
      name = slug + "_" + hashToHexString(hash);
      hash = hashInteger(hash, bumper++, 1);
    } while (seenNames[name] === YES);

    seenNames[name] = YES;
    return name;
  }

  return generateFilename;
}

function forceEscapeAsciiChar(c: string): string {
  const code = c.charCodeAt(0);
  return (code < 0x10 ? "%0" : "%") + code.toString(16);
}

// Windows restrictions, plus...
// : to reduce Mac confusion
// % because it's used for sanitizing
const FS_NAME_ESCAPE = /[\x00-\x1f"*\x2F:<>?\\|%]/g;

// https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file
const WINDOWS_BAD_NAMES = /^(?:CON|PRN|AUX|NUL|(?:COM|LPT)[0-9¹²³])(?:\.|$)/i;

export function sanitizeForFilename(name: string): string {
  // sanitize characters that are disallowed everywhere
  let sName = name.replace(FS_NAME_ESCAPE, (ch) => forceEscapeAsciiChar(ch));

  // position-dependent stuff

  // If the name matches an ancient forbidden Windows word, escape the
  // third character. This will let the first two characters sort of
  // maintain the sort order.
  if (WINDOWS_BAD_NAMES.test(name)) {
    sName = sName.slice(0, 2) + forceEscapeAsciiChar(name[2]) + sName.slice(3);
  }

  // Windows also disallows terminal space or dot, so escape them if
  // they occur there. This also escapes *leading* space or dot, which
  // is technically allowed, but leading spaces are confusing and
  // leading dots will hide the file on Unix-likes, including macOS.
  // This will also neutralize relative dirnames like . and ..
  sName = sName.replace(/^[. ]|[. ]$/, (ch) => forceEscapeAsciiChar(ch));

  return sName;
}
