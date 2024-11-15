export type NumericBounds = [number, number, number, number];
export type Num2 = [number, number];

export function translateNumericBounds(
  boundsValues: NumericBounds,
  delta: Num2,
): NumericBounds {
  return [
    boundsValues[0] + delta[0],
    boundsValues[1] + delta[1],
    boundsValues[2] + delta[0],
    boundsValues[3] + delta[1],
  ];
}

function unitValueNumber(v: UnitValue | number): number {
  return typeof v === "number" ? v : v.value;
}

export function unitValueAsPixels(value: UnitValue | number): number {
  // .d.ts is wrong; `as` returns number.
  // can't remember if it was always like this tho
  return typeof value === "number" ? value : unitValueNumber(value.as("px"));
}

export function unitRectAsPixels(rect: UnitRect): NumericBounds {
  return [
    unitValueAsPixels(rect[0]),
    unitValueAsPixels(rect[1]),
    unitValueAsPixels(rect[2]),
    unitValueAsPixels(rect[3]),
  ];
}
