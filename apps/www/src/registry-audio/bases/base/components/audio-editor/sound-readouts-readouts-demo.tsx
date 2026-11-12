import { useCallback, useState } from "react";
import {
  SoundChannels,
  type SoundLayout,
  SoundLevel,
  SoundRate,
  SoundReadout,
  SoundReadouts,
} from "@/registry-audio/bases/base/audio/elements/sound-readouts";

const LAYOUT_CHANNELS: Record<SoundLayout, number> = {
  "5.1": 6,
  "7.1": 8,
  mono: 1,
  stereo: 2,
};

const LEVELS = { loudness: -19.5, peak: -2.1, rms: -19.4 };

/** A sound's facts as parts: its level in the measure you pick, its rate and its channels, each a menu that says what to convert it to. */
export default function SoundReadoutsReadoutsDemo() {
  const [sampleRate, setSampleRate] = useState(48_000);
  const [channels, setChannels] = useState(2);
  const mix = useCallback(
    (layout: SoundLayout) => setChannels(LAYOUT_CHANNELS[layout]),
    []
  );
  return (
    <SoundReadouts>
      <SoundLevel levels={LEVELS} />
      <SoundReadout>{LEVELS.peak} dBFS</SoundReadout>
      <SoundRate onResample={setSampleRate} sampleRate={sampleRate} />
      <SoundChannels channels={channels} onMix={mix} />
    </SoundReadouts>
  );
}
