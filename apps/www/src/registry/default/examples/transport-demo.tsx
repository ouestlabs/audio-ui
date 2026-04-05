"use client";

import React from "react";
import { Transport } from "@/registry/default/ui/audio/elements/transport";

export default function TransportDemo() {
  const [value, setValue] = React.useState(42);

  return (
    <div className="flex w-full flex-col items-start gap-2">
      <Transport
        aria-label="Playback position"
        bufferedValue={78}
        onSeek={setValue}
        value={value}
      />
      <output
        aria-live="polite"
        className="w-12 text-center font-mono text-foreground text-sm tabular-nums"
      >
        {value.toFixed(0)}%
      </output>
    </div>
  );
}
