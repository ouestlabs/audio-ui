"use client";

import { useState } from "react";
import { Fader } from "@/registry/default/ui/audio/elements/fader";

export default function FaderBipolarDbDemo() {
  const [gain, setGain] = useState(0);

  return (
    <div className="flex flex-col items-center gap-2">
      <Fader max={6} min={-60} onValueChange={setGain} step={1} value={gain} />
      <output
        aria-live="polite"
        className="font-mono text-foreground text-sm tabular-nums"
      >
        {gain > 0 ? `+${gain}` : gain} dB
      </output>
    </div>
  );
}
