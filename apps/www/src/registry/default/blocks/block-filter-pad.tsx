"use client";

import { useState } from "react";
import { XYPad } from "@/registry/default/ui/audio/elements/xypad";

export default function BlockFilterPad() {
  const [value, setValue] = useState({ x: 30, y: 70 });

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <header className="flex items-center">
        <span className="font-medium text-muted-foreground text-xs">
          Filter
        </span>
      </header>
      <XYPad
        defaultValue={value}
        formatValue={(next) => `Cut ${next.x} | Res ${next.y}`}
        maxX={100}
        maxY={100}
        minX={0}
        minY={0}
        onValueChange={setValue}
        stepX={1}
        stepY={1}
        value={value}
        valueDisplay="hidden"
      />
      <div className="font-mono text-muted-foreground text-xs tabular-nums">
        Cutoff: {value.x}% - Resonance: {value.y}%
      </div>
    </section>
  );
}
