/*global File */
"use strict";


function toFile(fileOrString) {
  if (typeof fileOrString === "string") {
    return new File(fileOrString);
  }
  return fileOrString;
}


function errorForFile(file, operationName) {
  var message = "File error";
  if (operationName) {
    message += ": " + operationName;
  }

  var fsMessage = file.fsMessage;
  if (fsMessage) {
    message += " (" + fsMessage + ")";
  }

  var error = new Error(message);
  error.fsMessage = fsMessage || "<unspecified>";
  error.file = file;
  return error;
}


function throwIfFail(file, success, operationName) {
  if (!success) {
    throw errorForFile(file, operationName);
  }
}


function writeText(file, string) {
  file = toFile(file);
  throwIfFail(file, file.open("w"), "open");
  if (file.lineFeed.toLowerCase() === "macintosh") {
    // ExtendScript still thinks we're on MacOS Classic and
    // uses CR line endings by default. Change it to LF.
    file.lineFeed = "Unix";
  }
  file.encoding = "UTF-8";
  file.write(string);
  throwIfFail(file, file.close(), "close");
}


function writeJson(file, objectGraph, jsonStringifyOptions) {
  var replacer, space;
  if (jsonStringifyOptions) {
    replacer = jsonStringifyOptions.replacer;
    space = jsonStringifyOptions.space;
  }
  writeText(file, JSON.stringify(objectGraph, replacer, space) + "\n");
}


var BASE32 = "0123456789abcdefghjkmnpqrstvwxyz";

// REPLENISH_BITS is the number of bits to extract from a single call to
// Math.random().
//
// Experimentation suggests that at least in the ExtendScript implementation of
// Math.random(), there are never any more than 32 bits set in the float that
// is returned. We limit the number of bits to 27 so that the number of bits in
// the pool never exceeds 31. That way we don't have to worry about JS bit ops
// flipping the sign.  Though that might not matter.  But like I said, we don't
// have to worry about it.
var REPLENISH_BITS = 27;
var REPLENISH_FACTOR = Math.pow(2, REPLENISH_BITS);
function randomString(length) {
  var pool = 0;
  var poolBits = 0;
  var str = "";

  for (var i = 0; i < length; i++) {
    if (poolBits < 5) {
      var rnd = Math.random() * REPLENISH_FACTOR;
      pool |= Math.floor(rnd) << poolBits;
      poolBits += REPLENISH_BITS;
    }

    str += BASE32[pool & 31];
    pool >>= 5;
    poolBits -= 5;
  }

  return str;
}


function generateTempFile(folder, prefix, suffix) {
  if (!prefix) {
    prefix = "";
  }

  if (!suffix) {
    suffix = "";
  }

  var tempFile = null;

  do {
    var proposedFilename = prefix + randomString(25) + suffix;
    tempFile = File(folder.absoluteURI + "/" + proposedFilename);
  } while (tempFile.exists);

  return tempFile;
}


module.exports = {
  toFile: toFile,
  throwIfFail: throwIfFail,
  writeText: writeText,
  writeJson: writeJson,
  generateTempFile: generateTempFile
};
