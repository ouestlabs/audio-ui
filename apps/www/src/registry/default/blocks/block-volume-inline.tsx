"use client";

import { useId, useState } from "react";
import { Fader } from "@/registry/default/ui/audio/elements/fader";

export default function BlockVolumeInline() {
  const faderId = useId();
  const labelId = useId();
  const valueId = useId();
  const [value, setValue] = useState(50);

  return (
    <section
      aria-label="Volume control"
      className="flex w-full items-center gap-4 rounded-2xl border bg-card p-3"
    >
      <label
        className="shrink-0 font-medium text-muted-foreground text-sm"
        htmlFor={faderId}
        id={labelId}
      >
        Volume
      </label>
      <Fader
        aria-describedby={valueId}
        aria-labelledby={labelId}
        className="h-9 flex-1"
        id={faderId}
        max={100}
        min={0}
        onValueChange={setValue}
        orientation="horizontal"
        value={value}
      />
      <output
        aria-live="polite"
        className="w-12 shrink-0 truncate text-right font-medium text-muted-foreground text-sm tabular-nums"
        htmlFor={faderId}
        id={valueId}
      >
        {value}%
      </output>
    </section>
  );
}
