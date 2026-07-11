import { Piano } from "@/registry-audio/bases/base/audio/elements/piano";

export default function PianoDisabledDemo() {
  return <Piano aria-label="Piano" disabled endNote={72} startNote={48} />;
}
