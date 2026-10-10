import { Piano } from "@/registry-audio/bases/base/audio/elements/piano";

export default function PianoSizeSmDemo() {
  return <Piano aria-label="Piano" maxPitch={72} minPitch={48} size="sm" />;
}
