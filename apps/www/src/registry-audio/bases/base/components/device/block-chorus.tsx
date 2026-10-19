"use client";

import { useState } from "react";
import { ChorusPanel } from "@/registry-audio/bases/base/audio/panels/chorus-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type ChorusState,
  chorusDevice,
} from "@/registry-audio/bases/base/lib/chorus-device";
import { createChorusEngine } from "@/registry-audio/bases/base/lib/chorus-engine";

const MASTER_VOLUME = 0.7;

/**
 * A chorus you can plug in: its state, a panel that draws the sweep of its
 * delay and an engine that plays it, each its own file and none knowing the
 * others. Play the loop and turn the rate and the depth.
 */
export default function BlockChorus() {
  const [state, setState] = useState<ChorusState>(() =>
    chorusDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { tempo } = useDeviceLoop({
    create: createChorusEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <ChorusPanel onValueChange={setState} tempo={tempo} value={state} />
    </div>
  );
}
