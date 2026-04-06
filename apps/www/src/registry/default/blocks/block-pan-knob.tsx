"use client";

import { useId, useState } from "react";
import { Knob } from "@/registry/default/ui/audio/elements/knob";

function formatPan(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

export default function BlockPanKnob() {
  const knobId = useId();
  const labelId = useId();
  const valueId = useId();
  const [value, setValue] = useState(0);

  return (
    <section
      aria-label="Pan control"
      className="flex w-max flex-col items-center gap-3 rounded-xl border bg-card p-4"
    >
      <header className="flex items-center">
        <label
          className="font-medium text-muted-foreground text-xs"
          htmlFor={knobId}
          id={labelId}
        >
          Pan
        </label>
      </header>
      <Knob
        anchor={0}
        aria-describedby={valueId}
        aria-labelledby={labelId}
        id={knobId}
        max={100}
        min={-100}
        onValueChange={setValue}
        size="lg"
        value={value}
      />
      <output
        aria-live="polite"
        className="w-8 truncate text-center font-medium text-muted-foreground text-xs tabular-nums"
        htmlFor={knobId}
        id={valueId}
        title={formatPan(value)}
      >
        {formatPan(value)}
      </output>
    </section>
  );
}
