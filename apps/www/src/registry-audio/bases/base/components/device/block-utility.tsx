"use client";

import { useState } from "react";
import { UtilityPanel } from "@/registry-audio/bases/base/audio/panels/utility-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type UtilityState,
  utilityDevice,
} from "@/registry-audio/bases/base/lib/utility-device";
import { createUtilityEngine } from "@/registry-audio/bases/base/lib/utility-engine";

const MASTER_VOLUME = 0.7;

/**
 * A utility you can plug in: its state, a panel and an engine that plays it, each its own file and none knowing the others. Play the loop and move the pan and the width.
 */
export default function BlockUtility() {
  const [state, setState] = useState<UtilityState>(() =>
    utilityDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  useDeviceLoop({
    create: createUtilityEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <UtilityPanel onValueChange={setState} value={state} />
    </div>
  );
}
