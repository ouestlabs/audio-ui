"use client";
import { useState } from "react";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";

const formatHertz = (hertz: number) =>
  hertz >= 1000 ? `${(hertz / 1000).toFixed(1)} kHz` : `${hertz} Hz`;

export default function KnobFilterControlDemo() {
  const [cutoff, setCutoff] = useState(1000);

  return (
    <div className="flex flex-col items-center gap-2">
      <Knob
        aria-label="Cutoff"
        max={20_000}
        min={20}
        onValueChange={setCutoff}
        scale="log"
        step={1}
        value={cutoff}
        valueLabel="hidden"
      />
      <output className="text-sm tabular-nums">{formatHertz(cutoff)}</output>
    </div>
  );
}
