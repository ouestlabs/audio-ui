import { useState } from "react";
import {
  type TransientState,
  transientDevice,
} from "@/registry/bases/shared/devices/transient/device";
import { createTransientEngine } from "@/registry/bases/shared/devices/transient/engine";
import { TransientPanel } from "@/registry/bases/shared/devices/transient/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A transient shaper you can plug in: its state, a panel with a handle for
 * the attack and the sustain and an engine that plays it, each its own file
 * and none knowing the others. Play the loop and drag the handle: up for more
 * click, down to soften it, left to shorten what rings.
 */
export default function BlockTransient() {
  const [state, setState] = useState<TransientState>(() =>
    transientDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { engine } = useDeviceLoop({
    create: createTransientEngine,
    destination: master,
    state,
  });
  const signal = useDeviceSignal(engine, transientDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <TransientPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
