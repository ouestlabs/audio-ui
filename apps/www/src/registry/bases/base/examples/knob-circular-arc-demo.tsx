"use client";

import { useState } from "react";
import { Knob } from "@/registry/bases/base/ui/audio/elements/knob";

export default function KnobCircularArcDemo() {
  const [value, setValue] = useState(50);

  return (
    <div className="flex flex-col items-center gap-2">
      <Knob max={100} min={0} onValueChange={setValue} step={1} value={value} />
      <output
        aria-live="polite"
        className="font-mono text-foreground text-sm tabular-nums"
      >
        {value}
      </output>
    </div>
  );
}
