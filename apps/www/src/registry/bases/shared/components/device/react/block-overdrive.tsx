import { useState } from "react";
import {
  type OverdriveState,
  overdriveDevice,
} from "@/registry/bases/shared/devices/overdrive/device";
import { createOverdriveEngine } from "@/registry/bases/shared/devices/overdrive/engine";
import { OverdrivePanel } from "@/registry/bases/shared/devices/overdrive/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/devices/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * An overdrive you can plug in: its state, a panel that draws the band that
 * reaches the clip and an engine that plays it, each its own file and none
 * knowing the others. Play the loop, drag the handle and turn the drive.
 */
export default function BlockOverdrive() {
  const [state, setState] = useState<OverdriveState>(() =>
    overdriveDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { engine } = useDeviceLoop({
    create: createOverdriveEngine,
    destination: master,
    state,
  });
  const signal = useDeviceSignal(engine, overdriveDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <OverdrivePanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
