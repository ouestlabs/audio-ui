"use client";

import { useState } from "react";
import {
  type BinauralPannerState,
  binauralPannerDevice,
} from "@/registry-audio/bases/base/devices/binaural-panner/device";
import { createBinauralPannerEngine } from "@/registry-audio/bases/base/devices/binaural-panner/engine";
import { BinauralPannerPanel } from "@/registry-audio/bases/base/devices/binaural-panner/panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A binaural panner you can plug in: its state, a panel with the head seen
 * from above and an engine that plays it, each its own file and none knowing
 * the others. Put headphones on, play the loop and drag the sound around.
 */
export default function BlockBinauralPanner() {
  const [state, setState] = useState<BinauralPannerState>(() =>
    binauralPannerDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  useDeviceLoop({
    create: createBinauralPannerEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <BinauralPannerPanel onValueChange={setState} value={state} />
    </div>
  );
}
