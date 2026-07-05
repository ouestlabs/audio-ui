"use client";

import { useState } from "react";
import { XYPad } from "@/registry-audio/bases/base/audio/elements/xypad";

export default function XYPadBipolarRangeDemo() {
  const [value, setValue] = useState({ x: 0, y: 0 });

  return (
    <div className="flex flex-col items-center gap-2">
      <XYPad
        className="aspect-square"
        defaultValue={{ x: 0, y: 0 }}
        formatValue={(next) => `Pan ${next.x} | Mix ${next.y.toFixed(2)}`}
        maxX={100}
        maxY={1}
        minX={-100}
        minY={-1}
        onValueChange={setValue}
        stepX={1}
        stepY={0.01}
        value={value}
      />
      <output
        aria-live="polite"
        className="font-mono text-foreground text-sm tabular-nums"
      >
        Pan: {value.x} - Mix: {value.y.toFixed(2)}
      </output>
    </div>
  );
}
