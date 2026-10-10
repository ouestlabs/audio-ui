import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";

export default function KnobSizeVariantsDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Knob
        aria-label="Small knob"
        defaultValue={50}
        max={100}
        min={0}
        size="sm"
        step={1}
      />
      <Knob
        aria-label="Default knob"
        defaultValue={50}
        max={100}
        min={0}
        size="default"
        step={1}
      />
      <Knob
        aria-label="Large knob"
        defaultValue={50}
        max={100}
        min={0}
        size="lg"
        step={1}
      />
      <Knob
        aria-label="Extra large knob"
        defaultValue={50}
        max={100}
        min={0}
        size="xl"
        step={1}
      />
    </div>
  );
}
