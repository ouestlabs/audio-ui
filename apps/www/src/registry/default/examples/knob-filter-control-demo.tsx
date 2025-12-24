"use client";
import { useState } from "react";
import { Knob } from "@/registry/default/ui/audio/elements/knob";

export default function KnobFilterControlDemo() {
  const [cutoff, setCutoff] = useState(1000);

  return (
    <div className="flex flex-col items-center gap-2">
      <Knob
        max={20_000}
        min={20}
        onValueChange={setCutoff}
        step={1}
        value={cutoff}
      />
      <output className="text-sm">{cutoff} Hz</output>
    </div>
  );
}
