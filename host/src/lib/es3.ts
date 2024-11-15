export function arrayCopy<E>(array: ArrayLike<E>): E[] {
  const copy: E[] = [];
  for (let i = 0; i < array.length; i++) {
    copy.push(array[i]);
  }
  return copy;
}

export function arrayForEach<E>(
  array: ArrayLike<E>,
  fn: (element: E, index: number, array: ArrayLike<E>) => void,
) {
  for (let i = 0; i < array.length; i++) {
    fn(array[i], i, array);
  }
}

export function arrayMap<E, R>(
  array: ArrayLike<E>,
  fn: (element: E, index: number, array: ArrayLike<E>) => R,
): R[] {
  const result: R[] = [];
  for (let i = 0; i < array.length; i++) {
    result.push(fn(array[i], i, array));
  }
  return result;
}

export function arrayFilter<E>(
  array: ArrayLike<E>,
  fn: (element: E, index: number, array: ArrayLike<E>) => boolean,
): E[] {
  const result: E[] = [];
  for (let i = 0; i < array.length; i++) {
    if (fn(array[i], i, array)) {
      result.push(array[i]);
    }
  }
  return result;
}

export function arrayIndexOf<E>(haystack: ArrayLike<E>, needle: E) {
  for (let i = 0; i < haystack.length; i++) {
    if (haystack[i] === needle) {
      return i;
    }
  }
  return -1;
}

export function arrayContains<E>(haystack: ArrayLike<E>, needle: E) {
  return arrayIndexOf(haystack, needle) !== -1;
}

export function arrayReduce<E, R>(
  array: ArrayLike<E>,
  fn: (acc: R, element: E, index: number, array: ArrayLike<E>) => R,
  init: R,
): R {
  for (let i = 0; i < array.length; i++) {
    init = fn(init, array[i], i, array);
  }
  return init;
}

const hasOwnProperty = Object.prototype.hasOwnProperty;

export function objectKeys(obj: Record<string, any>): string[] {
  const keys: string[] = [];
  for (const key in obj) {
    if (hasOwnProperty.call(obj, key)) {
      keys.push(key);
    }
  }
  return keys;
}

export function objectValues<V>(obj: Record<string, V>): V[] {
  return arrayMap(objectKeys(obj), (k) => obj[k]);
}

export function objectEntries<V>(obj: Record<string, V>): Array<[string, V]> {
  return arrayMap(objectKeys(obj), (k) => [k, obj[k]]);
}

export function trim(s: string) {
  return s.replace(/^\s+|\s+$/g, "");
}
