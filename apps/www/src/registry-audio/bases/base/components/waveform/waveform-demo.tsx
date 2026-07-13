import { Waveform } from "@/registry-audio/bases/base/audio/elements/waveform";
import { waveformBars } from "@/registry-audio/bases/base/lib/waveform-path";

const VALUES = [
  0.2, 0.35, 0.5, 0.42, 0.6, 0.78, 0.65, 0.5, 0.38, 0.55, 0.7, 0.85, 0.92, 0.8,
  0.6, 0.45, 0.3, 0.4, 0.55, 0.68, 0.75, 0.6, 0.48, 0.35, 0.5, 0.65, 0.8, 0.9,
  0.75, 0.55, 0.4, 0.3, 0.45, 0.6, 0.72, 0.58, 0.42, 0.3, 0.2, 0.15,
];
const BARS = waveformBars(VALUES, { height: 100, width: 800 });

export default function WaveformDemo() {
  return (
    <Waveform aria-label="Track progress" bars={BARS} defaultValue={0.3} />
  );
}
