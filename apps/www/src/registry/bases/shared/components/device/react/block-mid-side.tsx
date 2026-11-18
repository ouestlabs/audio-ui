import { useState } from "react";
import {
  type MidSideState,
  midSideDevice,
} from "@/registry/bases/shared/devices/mid-side/device";
import { createMidSideEngine } from "@/registry/bases/shared/devices/mid-side/engine";
import { MidSidePanel } from "@/registry/bases/shared/devices/mid-side/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A mid/side device you can plug in: its state, a panel with a handle for the
 * mid and the side and an engine that plays it, each its own file and none
 * knowing the others. It plays a loop: take the side down and the image closes in on the
 * centre, turn Bass mono up and the low end leaves the sides.
 */
export default function BlockMidSide() {
  const [state, setState] = useState<MidSideState>(() =>
    midSideDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { engine } = useDeviceLoop({
    create: createMidSideEngine,
    destination: master,
    source: "groove",
    state,
  });
  const signal = useDeviceSignal(engine, midSideDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <MidSidePanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
