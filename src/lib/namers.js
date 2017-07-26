"use strict";


var fnvhash = require("./fnvhash");


function sanitizeStringPart(string) {
  // over-cautious, but has to be as restrictive as Save for Web unless i can
  // figure out how to get the adjusted filename back
  return string
    .replace(/\s+/g, " ")
    .replace(/[\x00-\x2F:-@\x5B-`{-\x7F\xA0]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}


function stringArrayToFilename(array) {
  var len = array.length;
  var sanitized = new Array(len);
  for (var i = 0; i < len; i++) {
    sanitized[i] = sanitizeStringPart(array[i]);
  }

  return sanitized.join("_");
}


var YES = { };
function uniquifier(separator, alwaysAddCounter) {
  if (!separator) {
    separator = "";
  }
  var generated = { };
  function makeUnique(str) {
    str = String(str);
    var counter = 0;
    var proposal = alwaysAddCounter ? str + separator + counter : str;
    while (generated[proposal] === YES) {
      proposal = str + separator + (++counter);
    }
    generated[proposal] = YES;
    return proposal;
  }
  return makeUnique;
}


var MAX_GENERATED_NAME_LENGTH = 64;
function layerPathNamer() {
  var makeUnique = uniquifier();
  function generateName(layerSnapshot) {
    var baseName =
      stringArrayToFilename(layerSnapshot.layerPath)
      .substr(0, MAX_GENERATED_NAME_LENGTH) || "unnamed";

    return makeUnique(baseName);
  }
  return generateName;
}

function counterNamer() {
  var counter = 0x1000;
  function generateName(_) {
    return (counter++).toString(16);
  }
  return generateName;
}


function hashNamer() {
  var makeUnique = uniquifier("-", true);

  function generateName(layerSnapshot) {
    var hash = fnvhash.stringArray(fnvhash.init(), layerSnapshot.layerPath);
    if (hash < 0) { // hashes come out signed
      hash += 4294967296;
    }
    var hashHex = ("0000000" + hash.toString(16)).slice(-8);
    return makeUnique(hashHex);
  }
  return generateName;
}

module.exports = {
  counterNamer:   counterNamer,
  hashNamer:      hashNamer,
  layerPathNamer: layerPathNamer
};
