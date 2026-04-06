"use client";

import { useId, useState } from "react";
import { Knob } from "@/registry/default/ui/audio/elements/knob";

export default function BlockLevelKnob() {
  const knobId = useId();
  const labelId = useId();
  const valueId = useId();
  const [value, setValue] = useState(50);

  return (
    <section
      aria-label="Level control"
      className="flex w-max flex-col items-center gap-3 rounded-xl border bg-card p-4"
    >
      <header className="flex items-center">
        <label
          className="font-medium text-muted-foreground text-xs"
          htmlFor={knobId}
          id={labelId}
        >
          Level
        </label>
      </header>
      <Knob
        aria-describedby={valueId}
        aria-labelledby={labelId}
        id={knobId}
        max={100}
        min={0}
        onValueChange={setValue}
        size="lg"
        value={value}
      />
      <output
        aria-live="polite"
        className="w-8 truncate text-center font-medium text-muted-foreground text-xs tabular-nums"
        htmlFor={knobId}
        id={valueId}
        title={`${value}%`}
      >
        {value}%
      </output>
    </section>
  );
}
