"use client";

import { useEffect, useRef, useState } from "react";
import { useWebAudio } from "@/registry-audio/bases/base/hooks/use-web-audio";

const VOLUME_RAMP_SECONDS = 0.01;

/**
 * A master output bus: one persistent GainNode wired to the shared
 * AudioContext's destination and kept in sync with a volume control. Every
 * sound source a block produces, synth voices, drum hits, connects into the
 * returned node instead of reaching `ctx.destination` directly, so a single
 * Fader governs the whole block's level. Returns `null` until the shared
 * AudioContext exists (SSR, or before the first client render).
 */
export function useMasterBus(volume: number): GainNode | null {
  const webAudio = useWebAudio();
  const [masterGain, setMasterGain] = useState<GainNode | null>(null);

  // Seeds the node's initial gain from the volume at mount without recreating
  // the node on every volume change, the sync effect below owns changes.
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!ctx) {
      return;
    }
    const gain = ctx.createGain();
    gain.gain.value = volumeRef.current;
    gain.connect(ctx.destination);
    setMasterGain(gain);
    return () => {
      gain.disconnect();
    };
  }, [webAudio]);

  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(ctx && masterGain)) {
      return;
    }
    masterGain.gain.setTargetAtTime(
      volume,
      ctx.currentTime,
      VOLUME_RAMP_SECONDS
    );
  }, [volume, masterGain, webAudio]);

  return masterGain;
}
