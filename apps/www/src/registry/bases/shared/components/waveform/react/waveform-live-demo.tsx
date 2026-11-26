import { useEffect, useState } from "react";
import { LiveWaveform } from "@/registry/bases/shared/audio-ui/elements/waveform";
import { createSource } from "@/registry/primitives/primitive";

/** A voice made up from a few slow waves: no microphone, no sound. */
function voiceAt(seconds: number) {
  const syllable = Math.max(0, Math.sin(seconds * 5.3)) ** 2;
  const breath = 0.55 + 0.45 * Math.sin(seconds * 0.9);
  return [Math.min(1, syllable * breath + 0.05)];
}

export default function WaveformLiveDemo() {
  const [level] = useState(() => createSource<ArrayLike<number>>([0]));
  useEffect(() => {
    let frame = 0;
    const tick = (now: number) => {
      level.set(voiceAt(now / 1000));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [level]);
  return <LiveWaveform aria-label="Voice" mode="scrolling" source={level} />;
}
