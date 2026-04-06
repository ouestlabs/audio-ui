"use client";

import { useId, useState } from "react";
import { Knob } from "@/registry/default/ui/audio/elements/knob";

function formatSigned(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

export default function BlockPanWidthControls() {
  const panId = useId();
  const panLabelId = useId();
  const panValueId = useId();
  const widthId = useId();
  const widthLabelId = useId();
  const widthValueId = useId();
  const [pan, setPan] = useState(0);
  const [width, setWidth] = useState(0);

  return (
    <section
      aria-label="Pan width controls"
      className="flex w-max flex-col gap-4 rounded-xl border bg-card p-4"
    >
      <header className="font-medium text-muted-foreground text-xs">
        Pan / Width
      </header>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col items-center gap-2">
          <label
            className="font-medium text-muted-foreground text-xs"
            htmlFor={panId}
            id={panLabelId}
          >
            Pan
          </label>
          <Knob
            anchor={0}
            aria-describedby={panValueId}
            aria-labelledby={panLabelId}
            id={panId}
            max={100}
            min={-100}
            onValueChange={setPan}
            size="lg"
            value={pan}
          />
          <output
            aria-live="polite"
            className="w-8 truncate text-center font-medium text-muted-foreground text-xs tabular-nums"
            htmlFor={panId}
            id={panValueId}
            title={formatSigned(pan)}
          >
            {formatSigned(pan)}
          </output>
        </div>
        <div className="flex flex-col items-center gap-2">
          <label
            className="font-medium text-muted-foreground text-xs"
            htmlFor={widthId}
            id={widthLabelId}
          >
            Width
          </label>
          <Knob
            anchor={0}
            aria-describedby={widthValueId}
            aria-labelledby={widthLabelId}
            id={widthId}
            max={100}
            min={-100}
            onValueChange={setWidth}
            size="lg"
            value={width}
          />
          <output
            aria-live="polite"
            className="w-8 truncate text-center font-medium text-muted-foreground text-xs tabular-nums"
            htmlFor={widthId}
            id={widthValueId}
            title={formatSigned(width)}
          >
            {formatSigned(width)}
          </output>
        </div>
      </div>
    </section>
  );
}
