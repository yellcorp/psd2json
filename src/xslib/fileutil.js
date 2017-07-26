/*global File */
"use strict";


function toFile(fileOrString) {
  if (typeof fileOrString === "string") {
    return new File(fileOrString);
  }
  return fileOrString;
}


function fileSucceedOrError(file, success) {
  if (!success) {
    var error = new Error("File error");
    error.fsMessage = file.error;
    error.file = file;
    throw error;
  }
}


function writeText(file, string) {
  file = toFile(file);
  fileSucceedOrError(file, file.open("w"));
  if (file.lineFeed.toLowerCase() === "macintosh") {
    // ExtendScript still thinks we're on MacOS Classic and
    // uses CR line endings by default. Change it to LF.
    file.lineFeed = "Unix";
  }
  file.encoding = "UTF-8";
  file.write(string);
  fileSucceedOrError(file, file.close());
}


function writeJson(file, objectGraph, jsonStringifyOptions) {
  var replacer, space;
  if (jsonStringifyOptions) {
    replacer = jsonStringifyOptions.replacer;
    space = jsonStringifyOptions.space;
  }
  writeText(file, JSON.stringify(objectGraph, replacer, space) + "\n");
}


module.exports = {
  toFile: toFile,
  writeText: writeText,
  writeJson: writeJson
};
