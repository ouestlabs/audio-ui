"use client";

import { useState } from "react";
import { DistortionPanel } from "@/registry-audio/bases/base/audio/panels/distortion-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type DistortionState,
  distortionDevice,
} from "@/registry-audio/bases/base/lib/distortion-device";
import { createDistortionEngine } from "@/registry-audio/bases/base/lib/distortion-engine";

const MASTER_VOLUME = 0.7;

/**
 * A distortion you can plug in: its state, a panel that draws its transfer
 * curve and an engine that plays it, each its own file and none knowing the
 * others. Play the loop and turn the drive: the curve bends as the sound does.
 */
export default function BlockDistortion() {
  const [state, setState] = useState<DistortionState>(() =>
    distortionDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  useDeviceLoop({
    create: createDistortionEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <DistortionPanel onValueChange={setState} value={state} />
    </div>
  );
}
