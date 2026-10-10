import { Waveform } from "@/registry-audio/bases/base/audio/elements/waveform";

// Stand-in for the peaks of a decoded audio file.
const VALUES = Array.from({ length: 512 }, (_, index) => {
  const time = index / 512;
  const section =
    0.5 + 0.28 * Math.sin(time * 11 + 0.8) + 0.18 * Math.sin(time * 29);
  const beat = 0.7 + 0.3 * Math.abs(Math.cos(index * 0.26));
  const grain = Math.abs((Math.sin(index * 12.9898) * 43_758.5453) % 1);
  const level = section * beat * (0.45 + 0.55 * grain) + 0.04;
  return Math.round(Math.min(1, level) * 1000) / 1000;
});

export default function WaveformPlayheadDemo() {
  return (
    <Waveform
      aria-label="Track progress"
      defaultValue={0.3}
      values={VALUES}
      variant="playhead"
    />
  );
}
