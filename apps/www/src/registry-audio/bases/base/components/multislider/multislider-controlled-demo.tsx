"use client";

import { useState } from "react";
import { Multislider } from "@/registry-audio/bases/base/audio/elements/multislider";

const initialLevels = [0.3, 0.6, 0.85, 0.5];

export default function MultisliderControlledDemo() {
  const [values, setValues] = useState(initialLevels);

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <Multislider
        aria-label="Harmonic levels"
        onValueChange={setValues}
        value={values}
      />
      <output className="text-center font-mono text-muted-foreground text-xs">
        {values.map((value) => value.toFixed(2)).join(" · ")}
      </output>
    </div>
  );
}
