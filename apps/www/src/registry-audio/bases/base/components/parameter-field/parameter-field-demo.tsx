"use client";

import { useState } from "react";
import { ParameterField } from "@/registry-audio/bases/base/audio/elements/parameter-field";

const SIGNED: Intl.NumberFormatOptions = { signDisplay: "exceptZero" };

export default function ParameterFieldDemo() {
  const [bpm, setBpm] = useState(120);
  return (
    <div className="grid w-full max-w-xs gap-2">
      <ParameterField
        label="Tempo"
        max={999}
        min={20}
        onValueChange={setBpm}
        precision={2}
        steppers
        unit="BPM"
        value={bpm}
      />
      <ParameterField
        defaultValue={-6}
        format={SIGNED}
        label="Gain"
        max={24}
        min={-36}
        step={0.1}
        unit="dB"
      />
      <ParameterField
        defaultValue={0}
        format={SIGNED}
        label="Transpose"
        max={48}
        min={-48}
        scrub="vertical"
        unit="st"
      />
      <ParameterField
        defaultValue={1200}
        label="Cutoff"
        largeStep={1000}
        max={20_000}
        min={20}
        step={10}
        unit="Hz"
      />
    </div>
  );
}
