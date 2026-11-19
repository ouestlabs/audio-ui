import type { ReactNode } from "react";
import { StereoField } from "@/registry/bases/shared/audio-ui/elements/stereo-field";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry/bases/shared/audio-ui/panels/device-panel";
import {
  type UtilityState,
  utilityDevice,
} from "@/registry/bases/shared/devices/utility/device";
import type { DeviceSignal } from "@/registry/lib/devices/device-signal";
import { cn } from "@/registry/lib/utils";

const KNOBS = ["gainDb", "pan", "width"] as const;
const OFF = utilityDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

interface UtilityPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: UtilityState) => void;
  /** Its live sound: where what comes out sits between the speakers and how alike its sides are, over its knobs, and its levels at the edge. */
  signal?: DeviceSignal;
  value: UtilityState;
}

/**
 * The face of the utility device: its gain, pan and width as knobs, and the
 * mono and invert switches. Given its signal, the stereo field of what comes
 * out stands over them; without one it has no display, and is only as tall as
 * its knobs. Controlled like `DevicePanel`, which it uses for them.
 * Its children sit at the end of the title bar.
 */
function UtilityPanel({
  children,
  className,
  onValueChange,
  signal,
  value,
}: UtilityPanelProps) {
  return (
    <DeviceFrame className={cn("h-full", className)} signal={signal}>
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
        {signal ? (
          <StereoField
            className="w-24 self-center"
            source={signal.output.stereo}
          />
        ) : null}
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
