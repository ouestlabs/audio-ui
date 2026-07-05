"use client";

import { useState } from "react";
import { XYPad } from "@/registry-audio/bases/base/audio/elements/xypad";

export default function XYPadChangeVsCommitDemo() {
  const [live, setLive] = useState({ x: 50, y: 50 });
  const [committed, setCommitted] = useState({ x: 50, y: 50 });

  return (
    <div className="flex flex-col items-center gap-2">
      <XYPad
        className="aspect-square"
        maxX={100}
        maxY={100}
        minX={0}
        minY={0}
        onValueChange={setLive}
        onValueCommit={setCommitted}
        value={live}
      />
      <div className="text-center font-mono text-foreground text-sm tabular-nums">
        <div>
          Live: X {live.x} - Y {live.y}
        </div>
        <div className="text-muted-foreground">
          Committed: X {committed.x} - Y {committed.y}
        </div>
      </div>
    </div>
  );
}
