import { useState } from "react";
import {
  type CompanderState,
  companderDevice,
} from "@/registry/bases/shared/devices/compander/device";
import { createCompanderEngine } from "@/registry/bases/shared/devices/compander/engine";
import { CompanderPanel } from "@/registry/bases/shared/devices/compander/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/devices/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A compander you can plug in: its state, a panel that draws its curve with a
 * handle on each point and an engine that plays it, each its own file and
 * none knowing the others. Play the loop and drag the points: under the
 * straight line of a clean sound they turn it down, over it up.
 */
export default function BlockCompander() {
  const [state, setState] = useState<CompanderState>(() =>
    companderDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { engine } = useDeviceLoop({
    create: createCompanderEngine,
    destination: master,
    state,
  });
  const signal = useDeviceSignal(engine, companderDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <CompanderPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
