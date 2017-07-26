"use strict";


function arraycopy(indexable) {
  var copy = [ ];
  for (var i = 0; i < indexable.length; i++) {
    copy.push(indexable[i]);
  }
  return copy;
}


module.exports = arraycopy;
