export function notNull<T>(value: T | null | undefined): T {
  if (value == null) {
    throw new Error("Value is " + value);
  }
  return value;
}
