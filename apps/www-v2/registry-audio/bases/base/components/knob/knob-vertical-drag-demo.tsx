"use client";

import { useState } from "react";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";

export default function KnobVerticalDragDemo() {
  const [value, setValue] = useState(50);

  return (
    <div className="flex flex-col items-center gap-2">
      <Knob
        dragOptions={{ verticalPanEnabled: true }}
        dragSensitivity="arc"
        max={100}
        min={0}
        onValueChange={setValue}
        step={1}
        value={value}
      />
      <output
        aria-live="polite"
        className="font-mono text-foreground text-sm tabular-nums"
      >
        {value}
      </output>
    </div>
  );
}
