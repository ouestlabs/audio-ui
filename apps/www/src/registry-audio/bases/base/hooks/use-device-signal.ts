import type { Device, ParameterDescriptor } from "@audio-ui/engine/device";
import { useMemo, useRef } from "react";
import {
  createDeviceSignal,
  type DeviceSignal,
  type SignalTarget,
} from "@/registry-audio/bases/base/lib/device-signal";

/**
 * The live signal of a device's engine, for its panel's `signal`: what goes
 * in and comes out, and what the device declares in `signals`. The signal is
 * the same object for the life of the component and follows `engine` as it
 * changes, silent while it is `null`, such as before the sound starts. It
 * listens only while its panel watches it, so it costs nothing on a page
 * where the panel is not drawn.
 */
export function useDeviceSignal(
  engine: SignalTarget | null,
  device: Pick<
    Device<readonly ParameterDescriptor[]>,
    "kind" | "sidechain" | "signals"
  >
): DeviceSignal {
  const current = useRef(engine);
  current.current = engine;
  return useMemo(
    () => createDeviceSignal(() => current.current, device),
    [device]
  );
}
