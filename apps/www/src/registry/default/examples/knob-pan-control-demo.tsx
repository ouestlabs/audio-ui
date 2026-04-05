"use client";
import { useState } from "react";
import { Knob } from "@/registry/default/ui/audio/elements/knob";

function formatPan(value: number): string {
  if (value === 0) {
    return "C";
  }
  return value < 0 ? `L${Math.abs(value)}` : `R${value}`;
}

export default function KnobPanControlDemo() {
  const [pan, setPan] = useState(0);

  return (
    <div className="flex flex-col items-center gap-2">
      <Knob
        anchor={0}
        max={50}
        min={-50}
        onValueChange={setPan}
        step={1}
        value={pan}
      />
      <output className="font-mono text-sm tabular-nums">
        {formatPan(pan)}
      </output>
      <span className="text-muted-foreground text-xs">Pan</span>
    </div>
  );
}
