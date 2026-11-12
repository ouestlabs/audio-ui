import { useState } from "react";
import { Lcd } from "@/registry-audio/bases/base/audio/elements/lcd";
import { ParameterField } from "@/registry-audio/bases/base/audio/elements/parameter-field";
import { ValueDisplay } from "@/registry-audio/bases/base/audio/elements/value-display";

export default function LcdDemo() {
  const [cutoff, setCutoff] = useState(1200);
  return (
    <div className="flex w-full max-w-xs flex-col gap-3">
      <Lcd className="w-full" label="Filter cutoff">
        <ValueDisplay kind="hz" size="lg" value={cutoff} />
      </Lcd>
      <div className="flex gap-2">
        <Lcd className="flex-1" label="Preset" size="sm">
          012 Warm Pad
        </Lcd>
        <Lcd className="flex-1" label="Tempo" size="sm">
          <ValueDisplay kind="bpm" size="sm" value={120} />
        </Lcd>
      </div>
      <ParameterField
        label="Cutoff"
        largeStep={1000}
        max={20_000}
        min={20}
        onValueChange={setCutoff}
        step={10}
        unit="Hz"
        value={cutoff}
      />
    </div>
  );
}
