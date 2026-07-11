import { Meter } from "@/registry-audio/bases/base/audio/elements/meter";

export default function MeterClippingDemo() {
  return <Meter aria-label="Stereo output" peak={[2, -6]} value={[1, -10]} />;
}
