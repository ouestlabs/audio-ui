"use client";

import { useState } from "react";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";

const FREQUENCY_MARKS = [
  { label: "20", value: 20 },
  100,
  { label: "1k", value: 1000 },
  10_000,
  { label: "20k", value: 20_000 },
];

const formatHertz = (hertz: number) =>
  hertz >= 1000 ? `${(hertz / 1000).toFixed(1)} kHz` : `${hertz} Hz`;

export default function KnobScaleDemo() {
  const [cutoff, setCutoff] = useState(1000);

  return (
    <Knob
      aria-label="Cutoff"
      formatValue={formatHertz}
      marks={FREQUENCY_MARKS}
      max={20_000}
      min={20}
      onValueChange={setCutoff}
      scale="log"
      size="lg"
      value={cutoff}
    />
  );
}
