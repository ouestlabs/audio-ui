"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  silentSource,
  useAudioSession,
} from "@/registry-audio/bases/base/hooks/use-audio-session";
import {
  DEMO_SOURCES,
  type DemoSourceName,
} from "@/registry-audio/bases/base/lib/demo-sound";

const NONE = { chosen: null, fallback: null };

/**
 * The sound a device plays: the one chosen in its session, such as from a
 * preview's bar, else `fallback`, the one that shows best what the device
 * does. It tells the session its fallback, so a bar can offer the choice only
 * where there is one. Outside a session it is always `fallback`.
 */
export function useDemoSource(fallback: DemoSourceName): DemoSourceName {
  const source = useAudioSession()?.source ?? silentSource;
  const { chosen } = useSyncExternalStore(
    source.subscribe,
    source.get,
    () => NONE
  );
  useEffect(() => {
    source.set({ fallback });
    return () => source.set({ fallback: null });
  }, [fallback, source]);
  return chosen !== null && chosen in DEMO_SOURCES
    ? (chosen as DemoSourceName)
    : fallback;
}
