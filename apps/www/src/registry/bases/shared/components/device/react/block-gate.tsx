import { useState } from "react";
import {
  type GateState,
  gateDevice,
} from "@/registry/bases/shared/devices/gate/device";
import { createGateEngine } from "@/registry/bases/shared/devices/gate/engine";
import { GatePanel } from "@/registry/bases/shared/devices/gate/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { useDemoSound } from "@/registry/bases/shared/hooks/use-demo-source";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/devices/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";

const MASTER_VOLUME = 0.7;
/** A loop whose tails fall under the threshold, so the gate closes between the hits. */
const START = {
  floorDb: -70,
  attackMs: 1,
  holdMs: 20,
  releaseMs: 80,
  thresholdDb: -24,
};

/**
 * A gate you can plug in: its state, a panel that draws its transfer curve
 * with a handle on the threshold and an engine that plays it, each its own
 * file. It plays a groove: raise the threshold and the tails of the hits are
 * cut shorter.
 */
export default function BlockGate() {
  const [state, setState] = useState<GateState>(
    () => gateDevice.apply(gateDevice.defaults(), START).state
  );
  const master = useMasterBus(MASTER_VOLUME);
  const sound = useDemoSound("groove");
  const { engine } = useDeviceLoop({
    create: createGateEngine,
    destination: master,
    sound,
    state,
  });
  const signal = useDeviceSignal(engine, gateDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <GatePanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
