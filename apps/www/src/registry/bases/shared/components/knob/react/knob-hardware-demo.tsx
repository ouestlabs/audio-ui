import { HardwareKnob } from "@/registry/bases/shared/audio-ui/skins/hardware/knob";

const MARKS = [
  { label: "0", value: 0 },
  25,
  50,
  75,
  { label: "100", value: 100 },
];

export default function KnobHardwareDemo() {
  return (
    <div className="skin-hardware audio-body flex items-center gap-6 rounded-xl px-8 py-6">
      <HardwareKnob
        aria-label="Level"
        defaultValue={50}
        editableValue
        marks={MARKS}
        max={100}
        min={0}
        size="lg"
        step={1}
      />
      <HardwareKnob aria-label="Drive" defaultValue={30} size="lg" />
    </div>
  );
}
