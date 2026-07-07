import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";

export default function KnobDisabledDemo() {
  return (
    <div className="flex flex-wrap items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <Knob defaultValue={38} disabled max={100} min={0} step={1} />
        <p className="text-center text-muted-foreground text-xs">Disabled</p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <Knob defaultValue={38} max={100} min={0} step={1} />
        <p className="text-center text-muted-foreground text-xs">Enabled</p>
      </div>
    </div>
  );
}
