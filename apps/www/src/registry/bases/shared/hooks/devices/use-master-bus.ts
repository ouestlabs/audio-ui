import { useEffect, useRef, useState } from "react";
import {
  createMasterBus,
  type MasterBus,
} from "@/registry/lib/devices/master-bus";
import { webAudio } from "@/registry/lib/web-audio";

/**
 * A master output bus on the page's context (`createMasterBus`), its volume
 * kept in sync with `volume`. Every source of a block connects to the
 * returned node instead of `ctx.destination`, so one fader governs the level
 * and a loud mix cannot clip the output. Returns `null` until the context
 * exists (on the server, or before the first client render).
 */
export function useMasterBus(volume: number): GainNode | null {
  const [bus, setBus] = useState<MasterBus | null>(null);
  // The volume at mount seeds the bus without making it again on each change.
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!ctx) {
      return;
    }
    const made = createMasterBus(ctx, volumeRef.current);
    setBus(made);
    return made.dispose;
  }, []);

  useEffect(() => {
    bus?.setVolume(volume);
  }, [volume, bus]);

  return bus?.input ?? null;
}
