"use client";

import { useState } from "react";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";

export default function KnobFineStepDemo() {
  const [value, setValue] = useState(0.5);

  return (
    <div className="flex flex-col items-center gap-2">
      <Knob
        defaultValue={0.5}
        max={1}
        min={0}
        onValueChange={setValue}
        step={0.01}
        value={value}
      />
      <output
        aria-live="polite"
        className="font-mono text-foreground text-sm tabular-nums"
      >
        {value.toFixed(2)}
      </output>
    </div>
  );
}
