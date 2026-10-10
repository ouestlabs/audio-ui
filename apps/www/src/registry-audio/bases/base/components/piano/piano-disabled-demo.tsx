import { Piano } from "@/registry-audio/bases/base/audio/elements/piano";

export default function PianoDisabledDemo() {
  return <Piano aria-label="Piano" disabled maxPitch={72} minPitch={48} />;
}
