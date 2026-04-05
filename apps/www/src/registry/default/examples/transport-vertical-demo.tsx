"use client";

import React from "react";
import { Transport } from "@/registry/default/ui/audio/elements/transport";

export default function TransportVerticalDemo() {
  const [value, setValue] = React.useState(42);

  return (
    <div className="flex items-end gap-4">
      <div className="h-40 w-8">
        <Transport
          aria-label="Playback position"
          bufferedValue={78}
          onSeek={setValue}
          orientation="vertical"
          value={value}
        />
      </div>
      <output
        aria-live="polite"
        className="w-12 text-center font-mono text-foreground text-sm tabular-nums"
      >
        {value.toFixed(0)}%
      </output>
    </div>
  );
}
