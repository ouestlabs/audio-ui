import * as React from "react";

/**
 * Converts a value to a ref to remove its reactivity.
 * Used to access the passed value inside `React.useEffect` without causing
 * the effect to re-run when the value changes.
 */
export function useValueAsRef<T>(value: T): React.RefObject<T> {
  const ref = React.useRef<T>(value);

  React.useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}
