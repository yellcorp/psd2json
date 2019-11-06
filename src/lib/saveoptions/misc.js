"use strict";


var WEB_COLOR = /^(?:#|0x)?((?:[0-9a-f]{3}){2})$/i;


function normalizeWebColorString(value) {
  if (typeof value === "number" && isFinite(value)) {
    return ("00000" + (value & 0xFFFFFF).toString(16)).slice(-6);
  }

  if (typeof value === "string") {
    var match = WEB_COLOR.exec(value);
    if (match) {
      var digits = match[1];
      if (digits.length === 6) {
        return digits;
      }

      return (
        digits[0] + digits[0] +
        digits[1] + digits[1] +
        digits[2] + digits[2]
      );
    }
  }

  return null;
}


exports.normalizeWebColorString = normalizeWebColorString;
