"use client";

import { useState } from "react";
import { OverdrivePanel } from "@/registry-audio/bases/base/audio/panels/overdrive-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type OverdriveState,
  overdriveDevice,
} from "@/registry-audio/bases/base/lib/overdrive-device";
import { createOverdriveEngine } from "@/registry-audio/bases/base/lib/overdrive-engine";

const MASTER_VOLUME = 0.7;

/**
 * An overdrive you can plug in: its state, a panel that draws the band that
 * reaches the clip and an engine that plays it, each its own file and none
 * knowing the others. Play the loop, drag the handle and turn the drive.
 */
export default function BlockOverdrive() {
  const [state, setState] = useState<OverdriveState>(() =>
    overdriveDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  useDeviceLoop({
    create: createOverdriveEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <OverdrivePanel onValueChange={setState} value={state} />
    </div>
  );
}
