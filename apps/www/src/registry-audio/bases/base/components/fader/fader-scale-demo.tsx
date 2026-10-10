"use client";

import { useState } from "react";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";

const DECIBEL_MARKS = [6, 0, -6, -12, -24, -36, -48, -60].map((value) => ({
  label: value > 0 ? `+${value}` : String(value),
  value,
}));

const formatDecibels = (decibels: number) =>
  `${decibels > 0 ? "+" : ""}${decibels.toFixed(1)} dB`;

export default function FaderScaleDemo() {
  const [gain, setGain] = useState(-12);

  return (
    <div className="flex h-64 items-center">
      <Fader
        aria-label="Gain"
        formatValue={formatDecibels}
        marks={DECIBEL_MARKS}
        max={6}
        min={-60}
        onValueChange={setGain}
        step={0.5}
        value={gain}
      />
    </div>
  );
}
