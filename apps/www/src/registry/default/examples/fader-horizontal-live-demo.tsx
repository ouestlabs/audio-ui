"use client";

import { useState } from "react";
import { Fader } from "@/registry/default/ui/audio/elements/fader";

export default function FaderHorizontalLiveDemo() {
  const [value, setValue] = useState(50);

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-2">
      <div className="h-9 w-full">
        <Fader
          max={100}
          min={0}
          onValueChange={setValue}
          orientation="horizontal"
          step={1}
          value={value}
        />
      </div>
      <output
        aria-live="polite"
        className="font-mono text-foreground text-sm tabular-nums"
      >
        {value}
      </output>
    </div>
  );
}
