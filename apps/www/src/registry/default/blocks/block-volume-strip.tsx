"use client";

import { useId, useState } from "react";
import { Fader } from "@/registry/default/ui/audio/elements/fader";

export default function BlockVolumeStrip() {
  const faderId = useId();
  const labelId = useId();
  const valueId = useId();
  const [value, setValue] = useState(64);

  return (
    <section
      aria-label="Volume control"
      className="flex flex-col items-center gap-4 rounded-xl border bg-card p-4"
    >
      <header className="flex items-center">
        <label
          className="font-medium text-muted-foreground text-xs"
          htmlFor={faderId}
          id={labelId}
        >
          Volume
        </label>
      </header>
      <Fader
        aria-describedby={valueId}
        aria-labelledby={labelId}
        id={faderId}
        max={100}
        min={0}
        onValueChange={setValue}
        value={value}
      />
      <output
        aria-live="polite"
        className="w-8 truncate text-center font-medium text-muted-foreground text-xs tabular-nums"
        htmlFor={faderId}
        id={valueId}
        title={`${value}%`}
      >
        {value}%
      </output>
    </section>
  );
}
