import * as React from "react";

const emptySubscribe = () => () => {
  // Nothing to clean up: hydration status never changes after mount.
};

export function useMounted() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
