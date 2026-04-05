"use client";

import { useState } from "react";
import { Knob } from "@/registry/default/ui/audio/elements/knob";

export default function KnobDoubleTapResetDemo() {
  const [value, setValue] = useState(72);

  return (
    <div className="flex max-w-xs flex-col items-center gap-2">
      <Knob
        defaultValue={30}
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
      <p className="text-center text-muted-foreground text-xs leading-snug">
        Double-tap the control to jump back to{" "}
        <span className="text-foreground">30</span> (
        <code className="text-foreground">defaultValue</code>).
      </p>
    </div>
  );
}
