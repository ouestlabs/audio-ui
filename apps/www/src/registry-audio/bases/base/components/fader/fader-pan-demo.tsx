"use client";

import { useState } from "react";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";

const formatPan = (pan: number) => {
  const amount = Math.round(Math.abs(pan) * 100);
  if (amount === 0) {
    return "C";
  }
  return `${pan < 0 ? "L" : "R"}${amount}`;
};

export default function FaderPanDemo() {
  const [pan, setPan] = useState(-0.3);

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-2">
      <Fader
        anchor={0}
        aria-label="Pan"
        max={1}
        min={-1}
        onValueChange={setPan}
        orientation="horizontal"
        step={0.01}
        value={pan}
      />
      <output className="font-mono text-sm tabular-nums">
        {formatPan(pan)}
      </output>
    </div>
  );
}
