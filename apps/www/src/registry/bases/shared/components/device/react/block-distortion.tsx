import { useState } from "react";
import {
  type DistortionState,
  distortionDevice,
} from "@/registry/bases/shared/devices/distortion/device";
import { createDistortionEngine } from "@/registry/bases/shared/devices/distortion/engine";
import { DistortionPanel } from "@/registry/bases/shared/devices/distortion/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A distortion you can plug in: its state, a panel that draws its transfer
 * curve and an engine that plays it, each its own file and none knowing the
 * others. Play the loop and turn the drive: the curve bends as the sound does.
 */
export default function BlockDistortion() {
  const [state, setState] = useState<DistortionState>(() =>
    distortionDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { engine } = useDeviceLoop({
    create: createDistortionEngine,
    destination: master,
    state,
  });
  const signal = useDeviceSignal(engine, distortionDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <DistortionPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
