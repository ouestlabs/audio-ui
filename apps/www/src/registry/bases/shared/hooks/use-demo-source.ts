import { useEffect, useState, useSyncExternalStore } from "react";
import type { DeviceLoopSound } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { usePlaySwitch } from "@/registry/bases/shared/hooks/devices/use-play-switch";
import {
  silentSource,
  useAudioSession,
} from "@/registry/bases/shared/hooks/input/use-audio-session";
import {
  DEMO_SOURCES,
  type DemoSourceName,
  demoKey,
  demoTempo,
  renderDemoSource,
} from "@/registry/lib/demo/demo-sound";
import { webAudio } from "@/registry/lib/web-audio";

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

/**
 * The demo sound a device plays (`useDemoSource`), rendered for the page's
 * context, with the kick that goes with it as a sidechain key when `key` is
 * set: the `sound` of `useDeviceLoop`. It is rendered once the play switch
 * of its session is on, so no context is made before a press; null until then.
 */
export function useDemoSound(
  fallback: DemoSourceName,
  { key = false }: { key?: boolean } = {}
): DeviceLoopSound | null {
  const name = useDemoSource(fallback);
  const { playing } = usePlaySwitch();
  const [sound, setSound] = useState<DeviceLoopSound | null>(null);
  useEffect(() => {
    const ctx = playing ? webAudio.getContext() : null;
    if (!ctx) {
      return;
    }
    let cancelled = false;
    Promise.all([
      renderDemoSource(name, ctx.sampleRate),
      key ? renderDemoSource(demoKey(name), ctx.sampleRate) : null,
    ]).then(([buffer, keyBuffer]) => {
      if (!cancelled) {
        setSound({ buffer, key: keyBuffer, tempo: demoTempo(name) });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [key, name, playing]);
  return sound;
}
