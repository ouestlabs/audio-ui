import { useState } from "react";
import {
  type GateState,
  gateDevice,
} from "@/registry-audio/bases/base/devices/gate/device";
import { createGateEngine } from "@/registry-audio/bases/base/devices/gate/engine";
import { GatePanel } from "@/registry-audio/bases/base/devices/gate/panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";

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
  useDeviceLoop({
    create: createGateEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <GatePanel onValueChange={setState} value={state} />
    </div>
  );
}
