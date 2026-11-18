import { useState } from "react";
import {
  type SaturatorState,
  saturatorDevice,
} from "@/registry/bases/base/devices/saturator/device";
import { createSaturatorEngine } from "@/registry/bases/base/devices/saturator/engine";
import { SaturatorPanel } from "@/registry/bases/base/devices/saturator/panel";
import { useDeviceLoop } from "@/registry/bases/base/hooks/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/base/hooks/use-device-signal";
import { useMasterBus } from "@/registry/bases/base/hooks/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A saturator you can plug in: its state, a panel that draws its transfer
 * curve and an engine that plays it, each its own file and none knowing the
 * others. Play the loop, pick a curve and turn the drive: the curve bends as
 * the sound does.
 */
export default function BlockSaturator() {
  const [state, setState] = useState<SaturatorState>(() =>
    saturatorDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { engine } = useDeviceLoop({
    create: createSaturatorEngine,
    destination: master,
    state,
  });
  const signal = useDeviceSignal(engine, saturatorDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <SaturatorPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
