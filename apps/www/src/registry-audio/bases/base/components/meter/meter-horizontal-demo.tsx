import { Meter } from "@/registry-audio/bases/base/audio/elements/meter";

export default function MeterHorizontalDemo() {
  return (
    <Meter
      aria-label="Stereo output"
      orientation="horizontal"
      peak={[-4, -8]}
      size="sm"
      value={[-9, -14]}
    />
  );
}
