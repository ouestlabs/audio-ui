import { Knob } from "@/registry/bases/shared/audio-ui/elements/knob";

const MARKS = [
  { label: "0", value: 0 },
  25,
  50,
  75,
  { label: "100", value: 100 },
];

export default function KnobNeuDemo() {
  return (
    <div className="skin-neu audio-body flex items-center gap-8 rounded-2xl px-10 py-8">
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
      <Knob aria-label="Drive" defaultValue={30} size="lg" />
    </div>
  );
}
