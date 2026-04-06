"use client";

import { useId, useState } from "react";
import { Fader } from "@/registry/default/ui/audio/elements/fader";

export default function BlockVolumeSlider() {
  const faderId = useId();
  const labelId = useId();
  const valueId = useId();
  const [value, setValue] = useState(72);

  return (
    <section
      aria-label="Volume control"
      className="flex w-full flex-col gap-4 rounded-xl border bg-card p-5"
    >
      <header className="flex items-center justify-between">
        <label
          className="font-medium text-muted-foreground text-xs"
          htmlFor={faderId}
          id={labelId}
        >
          Volume
        </label>
        <output
          aria-live="polite"
          className="w-12 truncate text-right font-medium text-muted-foreground text-xs tabular-nums"
          htmlFor={faderId}
          id={valueId}
          title={`${value}%`}
        >
          {value}%
        </output>
      </header>
      <Fader
        aria-describedby={valueId}
        aria-labelledby={labelId}
        id={faderId}
        max={100}
        min={0}
        onValueChange={setValue}
        orientation="horizontal"
        value={value}
      />
    </section>
  );
}
