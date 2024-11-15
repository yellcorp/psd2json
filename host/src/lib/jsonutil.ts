// This is a very concise, not
// standards-compliant-but-good-enough-for-our-purposes JSON serializer
// which uses some ExtendScript quirks to avoid re-implementing string
// escaping and Array detection
//
// Also I tried `$.uneval` but it's not JSON. Unquoted property names
// and a strange tendency to use parens around values.
//
import { arrayMap, objectEntries } from "./es3";

function pad2(number: number) {
  return `0${number}`.slice(-2);
}

function dateToISOString(d: Date) {
  if (!isFinite(d.getTime())) return "null";
  const year = d.getUTCFullYear();
  const month = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  const hour = pad2(d.getUTCHours());
  const minute = pad2(d.getUTCMinutes());
  const second = pad2(d.getUTCSeconds());
  const msec = d.getUTCMilliseconds() % 1000;
  const msecStr = `00${msec}`.slice(-3);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${msecStr}Z`;
}

function jsonFormatElements(
  els: string[],
  wrappers: string,
  outerIndent: string,
  innerIndent: string,
) {
  if (els.length === 0) return wrappers;
  let beforeEl = "";
  let beforeCloser = "";
  if (outerIndent || innerIndent) {
    beforeEl = `\n${innerIndent}`;
    beforeCloser = `\n${outerIndent}`;
  }
  return (
    wrappers.charAt(0) +
    beforeEl +
    els.join("," + beforeEl) +
    beforeCloser +
    wrappers.charAt(1)
  );
}

function jsonMaybeStringify(
  value: any,
  currentIndent: string,
  indentInc: string,
) {
  if (value === undefined) return undefined;
  if (value === null) return "null";

  const nextIndent = currentIndent + indentInc;

  switch (value.reflect.name) {
    case "Number":
      return isFinite(value) ? `${value}` : "null";
    case "Boolean":
      return value ? "true" : "false";
    case "String":
      return value.toSource().slice(12, -2);
    case "Array":
      return jsonFormatElements(
        arrayMap(value, (v) =>
          jsonStringifyUndefToNull(v, nextIndent, indentInc),
        ),
        "[]",
        currentIndent,
        nextIndent,
      );
    case "Date":
      return dateToISOString(value);
    default: {
      const pairs: string[] = [];
      const kvSep = indentInc ? ": " : ":";
      for (let [key, subValue] of objectEntries(value)) {
        const jValue = jsonMaybeStringify(subValue, nextIndent, indentInc);
        if (jValue !== undefined) {
          const jKey = jsonMaybeStringify(key, nextIndent, indentInc);
          if (jKey !== undefined) {
            pairs.push(`${jKey}${kvSep}${jValue}`);
          }
        }
      }
      return jsonFormatElements(pairs, "{}", currentIndent, nextIndent);
    }
  }
}

export function jsonStringifyUndefToNull(
  value: any,
  currentIndent: string,
  indentInc: string,
): string {
  const repr = jsonMaybeStringify(value, currentIndent, indentInc);
  return repr === undefined ? "null" : repr;
}

export function jsonStringify(value: any, indent?: string): string {
  return jsonStringifyUndefToNull(value, "", indent || "");
}
