"use client";

import { useState } from "react";
import { Fader } from "@/registry/default/ui/audio/elements/fader";

export default function FaderVerticalLiveDemo() {
  const [value, setValue] = useState(50);

  return (
    <div className="flex flex-col items-center gap-2">
      <Fader
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
