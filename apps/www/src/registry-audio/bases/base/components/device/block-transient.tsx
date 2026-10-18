"use client";

import { useState } from "react";
import { TransientPanel } from "@/registry-audio/bases/base/audio/panels/transient-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type TransientState,
  transientDevice,
} from "@/registry-audio/bases/base/lib/transient-device";
import { createTransientEngine } from "@/registry-audio/bases/base/lib/transient-engine";

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
  useDeviceLoop({
    create: createTransientEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <TransientPanel onValueChange={setState} value={state} />
    </div>
  );
}
