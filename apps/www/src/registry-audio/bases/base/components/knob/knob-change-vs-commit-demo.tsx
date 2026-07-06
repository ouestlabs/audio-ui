"use client";

import { useState } from "react";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";

export default function KnobChangeVsCommitDemo() {
  const [liveValue, setLiveValue] = useState(64);
  const [committedValue, setCommittedValue] = useState(64);

  return (
    <div className="flex flex-col items-center gap-2">
      <Knob
        max={100}
        min={0}
        onValueChange={setLiveValue}
        onValueCommit={setCommittedValue}
        step={1}
        value={liveValue}
      />
      <div className="text-center font-mono text-foreground text-sm tabular-nums">
        <div>Live: {liveValue}</div>
        <div className="text-muted-foreground">Committed: {committedValue}</div>
      </div>
    </div>
  );
}
