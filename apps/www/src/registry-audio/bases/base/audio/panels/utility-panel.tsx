"use client";

import type { ReactNode } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  type UtilityState,
  utilityDevice,
} from "@/registry-audio/bases/base/lib/utility-device";

const KNOBS = ["gainDb", "pan", "width"] as const;
const OFF = utilityDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

interface UtilityPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: UtilityState) => void;
  value: UtilityState;
}

/**
 * The face of the utility device: its gain, pan and width as knobs, and the
 * mono and invert switches in the title bar. It has no display, so it is only
 * as tall as its knobs. Controlled like `DevicePanel`, which it uses for them.
 * Its children sit at the end of the title bar.
 */
function UtilityPanel({
  children,
  className,
  onValueChange,
  value,
}: UtilityPanelProps) {
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={utilityDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col justify-center gap-2 p-2"
        data-slot="utility-panel"
      >
        <DevicePanel
          className="grid-cols-3"
          device={utilityDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={["enabled", "mono", "invert"]}
          onValueChange={onValueChange}
          value={value}
        />
        <div className="flex justify-center gap-1.5">
          <DevicePanel
            className="flex gap-1.5"
            device={utilityDevice}
            disabled={value.enabled ? undefined : OFF}
            exclude={[...KNOBS, "enabled"]}
            onValueChange={onValueChange}
            value={value}
          />
        </div>
      </div>
    </DeviceFrame>
  );
}

export { UtilityPanel };
