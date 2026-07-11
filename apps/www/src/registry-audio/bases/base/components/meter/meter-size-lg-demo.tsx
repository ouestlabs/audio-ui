import { Meter } from "@/registry-audio/bases/base/audio/elements/meter";

export default function MeterSizeLgDemo() {
  return (
    <Meter
      aria-label="Stereo output"
      peak={[-4, -8]}
      size="lg"
      value={[-9, -14]}
    />
  );
}
