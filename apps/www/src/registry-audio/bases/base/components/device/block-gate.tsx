"use client";

import { useState } from "react";
import { GatePanel } from "@/registry-audio/bases/base/audio/panels/gate-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  renderHeldChord,
  renderKickLoop,
} from "@/registry-audio/bases/base/lib/demo-loop";
import {
  type GateState,
  gateDevice,
} from "@/registry-audio/bases/base/lib/gate-device";
import { createGateEngine } from "@/registry-audio/bases/base/lib/gate-engine";

const MASTER_VOLUME = 0.7;
/** A held chord, opened by the kick of the loop: the key is heard by the gate only. */
const START = {
  external: true,
  floorDb: -70,
  attackMs: 1,
  holdMs: 20,
  releaseMs: 80,
  thresholdDb: -24,
};

/**
 * A gate you can plug in: its state, a panel that draws its transfer curve
 * with a handle on the threshold and an engine that plays it, each its own
 * file. It starts keyed: a held chord that the kick of the loop opens and
 * closes. Raise the threshold and the kick opens it for less time; switch the
 * key off and the gate follows the chord itself.
 */
export default function BlockGate() {
  const [state, setState] = useState<GateState>(
    () => gateDevice.apply(gateDevice.defaults(), START).state
  );
  const master = useMasterBus(MASTER_VOLUME);
  useDeviceLoop({
    create: createGateEngine,
    destination: master,
    key: renderKickLoop,
    signal: renderHeldChord,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <GatePanel onValueChange={setState} value={state} />
    </div>
  );
}
