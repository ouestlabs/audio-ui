import * as React from "react";

const emptySubscribe = () => () => {
  // Nothing to clean up: hydration status never changes after mount.
};

/** Whether the component has hydrated: false on the server and in the first client render, true after. */
export function useMounted(): boolean {
  return React.useSyncExternalStore<boolean>(
    emptySubscribe,
    () => true,
    () => false
  );
}
