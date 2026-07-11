import { Meter } from "@/registry-audio/bases/base/audio/elements/meter";

export default function MeterSizeSmDemo() {
  return (
    <Meter
      aria-label="Stereo output"
      peak={[-4, -8]}
      size="sm"
      value={[-9, -14]}
    />
  );
}
