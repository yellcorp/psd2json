export function initHash(): number {
  return 0x811c9dc5;
}

export function hashInteger(
  hashValue: number,
  theInt: number,
  byteCount: number,
): number {
  for (let i = 0; i < byteCount; i++) {
    hashValue ^= theInt & 0xff;
    hashValue = (hashValue * 0x1000193) & 0xffffffff;
    theInt >>>= 8;
  }
  return hashValue;
}

export function hashString(hashValue: number, theString: string): number {
  const len = theString.length;
  for (let i = 0; i < len; i++) {
    hashValue = hashInteger(hashValue, theString.charCodeAt(i), 2);
  }
  return hashValue;
}

export function hashToHexString(hashValue: number): string {
  // force unsigned interpretation
  const posInt = (hashValue >>> 0).toString(16);
  return `0000000${posInt}`.slice(-8);
}
