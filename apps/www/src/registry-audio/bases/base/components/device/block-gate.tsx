"use client";

import { useState } from "react";
import { PlayToggle } from "@/registry-audio/bases/base/audio/elements/play-toggle";
import { GatePanel } from "@/registry-audio/bases/base/audio/panels/gate-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type GateState,
  gateDevice,
} from "@/registry-audio/bases/base/lib/gate-device";
import { createGateEngine } from "@/registry-audio/bases/base/lib/gate-engine";

const MASTER_VOLUME = 0.7;

/**
 * A gate you can plug in: its state, a panel that draws its transfer curve with a handle on the threshold and an engine that plays it, each its own file. Play the loop and raise the threshold: the quiet parts go.
 */
export default function BlockGate() {
  const [state, setState] = useState<GateState>(() => gateDevice.defaults());
  const master = useMasterBus(MASTER_VOLUME);
  const { playing, toggle } = useDeviceLoop({
    create: createGateEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <GatePanel onValueChange={setState} value={state}>
        <PlayToggle
          label="Play a loop through it"
          onToggle={toggle}
          playing={playing}
        />
      </GatePanel>
    </div>
  );
}
