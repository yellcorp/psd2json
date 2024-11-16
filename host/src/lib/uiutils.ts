import { arrayCopy, arrayForEach, arrayIndexOf, objectKeys } from "./es3";

function _indexControls(container: any, index: Record<string, any>) {
  if (typeof container?.children?.length === "number") {
    const children = container.children as ArrayLike<any>;

    // Prioritize child objects that have a `name` property
    arrayForEach(children, (child) => {
      if (typeof child?.name === "string" && child.name && !index[child.name]) {
        index[child.name] = child;
      }
    });

    const keyedChildren = arrayCopy(children);

    // However, the `name` property isn't automatically set when using a
    // resource string.  It has to be explicitly set and that can lead to a lot
    // of repetition, for example:
    //
    // ```
    // btnConfirm: Button {
    //   name: 'btnConfirm'
    // }
    // ```
    //
    // So as a convenience, also scan the properties on the container to
    // see if any of them refer to objects that also appear in the
    // `children` array.  If so, consider the child name to be the same
    // as the container property name.

    const containerKeys = objectKeys(container);
    for (let i = 0; i < containerKeys.length; i++) {
      const key = containerKeys[i];
      if (!index[key]) {
        const value = container[key];
        if (value && typeof value === "object") {
          const kci = arrayIndexOf(keyedChildren, value);
          if (kci !== -1) {
            index[key] = keyedChildren[kci];

            // cheeky O(1) array removal. The caveat is that order is not
            // preserved, but we don't care here.
            if (kci === keyedChildren.length - 1) {
              keyedChildren.pop();
            } else {
              keyedChildren[kci] = keyedChildren.pop()!;
            }

            // Stop early if all kids are accounted for
            if (keyedChildren.length === 0) {
              break;
            }
          }
        }
      }
    }

    // Then recurse, breadth-first
    arrayForEach(children, (child) => {
      _indexControls(child, index);
    });
  }
}

/**
 * Indexes all controls in a container and its descendants by either:
 * - Their `name` property.
 * - The property name in the container object that refers to them.
 *
 * Only the first control with a given name is indexed. `name`
 * properties take precedence over container object properties, and
 * shallower controls take precedence over more deeply nested ones.
 *
 * @param container The container to index.
 * @returns An object mapping control names to controls.
 */
export function indexControls(container: unknown): Record<string, any> {
  const index = {};
  _indexControls(container, index);
  return index;
}
