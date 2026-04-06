"use client";

import { useId, useState } from "react";
import { Fader } from "@/registry/default/ui/audio/elements/fader";
import { XYPad } from "@/registry/default/ui/audio/elements/xypad";

export default function BlockAtmosMorphPad() {
  const faderId = useId();
  const labelId = useId();
  const valueId = useId();
  const [morph, setMorph] = useState({ x: 60, y: 20 });
  const [mix, setMix] = useState(60);

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <header className="font-medium text-muted-foreground text-xs">
        Atmos Morph
      </header>
      <XYPad
        defaultValue={morph}
        formatValue={(next) => `Color ${next.x} | Space ${next.y}`}
        maxX={100}
        maxY={100}
        minX={-100}
        minY={-100}
        onValueChange={setMorph}
        stepX={1}
        stepY={1}
        value={morph}
      />
      <div className="flex w-full items-center gap-4 rounded-lg border bg-card p-3">
        <label
          className="shrink-0 font-medium text-muted-foreground text-sm"
          htmlFor={faderId}
          id={labelId}
        >
          Wet
        </label>
        <Fader
          aria-describedby={valueId}
          aria-labelledby={labelId}
          className="h-9 flex-1"
          defaultValue={mix}
          id={faderId}
          max={100}
          min={0}
          onValueChange={setMix}
          orientation="horizontal"
          value={mix}
        />
        <output
          aria-live="polite"
          className="w-12 shrink-0 truncate text-right font-medium text-muted-foreground text-sm tabular-nums"
          htmlFor={faderId}
          id={valueId}
        >
          {mix}%
        </output>
      </div>
    </section>
  );
}
