"use strict";


var FNV_PRIME_32 = 0x1000193;
var FNV_OFFSET_BASIS_32 = 0x811c9dc5;
var FNV_MOD_32 = 0xffffffff;


function init() {
  return FNV_OFFSET_BASIS_32;
}


function integer(h, n, byteCount) {
  for (var i = 0; i < byteCount; i++) {
    h ^= n & 0xFF;
    h = (h * FNV_PRIME_32) & FNV_MOD_32;
    n >>>= 8;
  }
  return h;
}


function string(h, str) {
  var len = str.length;
  for (var i = 0; i < len; i++) {
    h = integer(h, str.charCodeAt(i), 2);
  }
  return h;
}


function stringArray(h, array) {
  for (var i = 0; i < array.length; i++) {
    h = integer(string(h, array[i]), 0x001e, 2);
  }
  return h;
}


module.exports = {
  init:        init,
  integer:     integer,
  string:      string,
  stringArray: stringArray
};
