"use client";

import { useState } from "react";
import { Led } from "@/registry-audio/bases/base/audio/elements/led";
import { RockerSwitch } from "@/registry-audio/bases/base/audio/elements/rocker-switch";

export default function RockerSwitchDemo() {
  const [power, setPower] = useState(true);
  return (
    <div className="flex items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <Led label="Power" on={power} />
        <RockerSwitch
          aria-label="Power"
          checked={power}
          onCheckedChange={setPower}
        />
        <span className="text-muted-foreground text-xs uppercase tracking-wide">
          Power
        </span>
      </div>
      <RockerSwitch
        aria-label="Phase invert"
        defaultChecked={false}
        offLabel="Ø"
        onLabel="Ø"
        orientation="horizontal"
        size="sm"
      />
      <RockerSwitch aria-label="Pad, disabled" disabled size="sm" />
    </div>
  );
}
