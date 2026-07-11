"use client";

import { useState } from "react";
import { Envelope } from "@/registry-audio/bases/base/audio/elements/envelope";

const initialPoints = [
  { x: 0, y: 0.1 },
  { x: 0.2, y: 0.95 },
  { x: 0.4, y: 0.5 },
  { x: 0.75, y: 0.55 },
  { x: 1, y: 0.1 },
];

export default function EnvelopeControlledDemo() {
  const [points, setPoints] = useState(initialPoints);

  return (
    <div className="flex w-full flex-col gap-3">
      <Envelope
        aria-label="ADSR envelope"
        onValueChange={setPoints}
        value={points}
      />
      <output className="text-center font-mono text-muted-foreground text-xs">
        {points.length} points
      </output>
    </div>
  );
}
