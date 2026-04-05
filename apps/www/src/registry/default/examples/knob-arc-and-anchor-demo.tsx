"use client";

import { Knob } from "@/registry/default/ui/audio/elements/knob";

export default function KnobArcAndAnchorDemo() {
  return (
    <div className="flex flex-wrap items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <Knob defaultValue={72} max={100} min={0} step={1} />
        <p className="text-center text-muted-foreground text-xs">Value only</p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Knob anchor={30} defaultValue={75} max={100} min={0} step={1} />
        <p className="text-center text-muted-foreground text-xs">
          With <code className="text-foreground">anchor</code> range
        </p>
      </div>
    </div>
  );
}
