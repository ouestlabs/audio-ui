import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {
  // Nothing to clean up: the platform never changes at runtime.
};

export function useIsMac() {
  return useSyncExternalStore(
    emptySubscribe,
    () => navigator.platform.toUpperCase().includes("MAC"),
    () => true
  );
}
