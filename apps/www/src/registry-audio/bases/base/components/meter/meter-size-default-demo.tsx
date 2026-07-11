import { Meter } from "@/registry-audio/bases/base/audio/elements/meter";

export default function MeterSizeDefaultDemo() {
  return <Meter aria-label="Stereo output" peak={[-4, -8]} value={[-9, -14]} />;
}
