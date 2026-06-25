"use client";

import { useState } from "react";
import { XYPad } from "@/registry/bases/base/ui/audio/elements/xypad";

export default function XYPadLiveValueDemo() {
  const [value, setValue] = useState({ x: 50, y: 50 });

  return (
    <div className="flex flex-col items-center gap-2">
      <XYPad
        className="aspect-square"
        maxX={100}
        maxY={100}
        minX={0}
        minY={0}
        onValueChange={setValue}
        value={value}
      />
      <output
        aria-live="polite"
        className="font-mono text-foreground text-sm tabular-nums"
      >
        X: {value.x} - Y: {value.y}
      </output>
    </div>
  );
}
