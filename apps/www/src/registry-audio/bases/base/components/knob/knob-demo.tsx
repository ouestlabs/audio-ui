import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";

const MARKS = [
  { label: "0", value: 0 },
  25,
  50,
  75,
  { label: "100", value: 100 },
];

export default function KnobDemo() {
  return (
    <Knob
      aria-label="Level"
      defaultValue={50}
      editableValue
      marks={MARKS}
      max={100}
      min={0}
      size="lg"
      step={1}
    />
  );
}
