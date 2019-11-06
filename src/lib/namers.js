"use strict";


var fnvhash = require("./fnvhash");


function escapeChar(c) {
  var cc = c.charCodeAt(0);
  return (cc < 16 ? "%0" : "%") + cc.toString(16).toUpperCase();
}


// percent and comma are added because percent escapes, and comma separates
// layer path segments
var FS_NAME_ESCAPE = /[\x00-\x1f"*\x2F:<>?\\|%,]/g;
function sanitizeStringPart(string) {
  return string.replace(
    FS_NAME_ESCAPE,
    function (match) {
      return escapeChar(match);
    }
  );
}


var NTFS_BAD_NAMES = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;
function sanitizeWholeName(name) {
  if (name === ".") {
    return "%2E";
  }

  if (name === "..") {
    return "%2E%2E";
  }

  // Windows has a list of forbidden ancient words. Escape the third character
  // if it matches - this will roughly maintain sort order.
  if (NTFS_BAD_NAMES.test(name + ".")) {
    name = name.substring(0, 2) +
      escapeChar(name[2]) +
      name.substring(3);
  }

  // Windows doesn't allow ending a name with a space or dot. Escape the last
  // character if it's one of those. While we're here - do the same with the
  // first character. It's allowed but spaces at the beginning of a filename
  // are just as confusing, and leading dots create hidden files - let's avoid
  // that as well.
  name = name.replace(
    /^[. ]|[. ]$/,
    function (match) {
      return escapeChar(match);
    }
  );

  return name;
}


function stringArrayToFilename(array) {
  var len = array.length;
  var sanitized = new Array(len);
  for (var i = 0; i < len; i++) {
    sanitized[i] = sanitizeStringPart(array[i]);
  }

  return sanitizeWholeName(sanitized.join(","));
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
