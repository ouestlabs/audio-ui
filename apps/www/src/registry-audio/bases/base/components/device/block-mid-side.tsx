"use client";

import { useState } from "react";
import { MidSidePanel } from "@/registry-audio/bases/base/audio/panels/mid-side-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type MidSideState,
  midSideDevice,
} from "@/registry-audio/bases/base/lib/mid-side-device";
import { createMidSideEngine } from "@/registry-audio/bases/base/lib/mid-side-engine";

const MASTER_VOLUME = 0.7;

/**
 * A mid/side device you can plug in: its state, a panel with a handle for the
 * mid and the side and an engine that plays it, each its own file and none
 * knowing the others. It plays a loop: take the side down and the image closes in on the
 * centre, turn Bass mono up and the low end leaves the sides.
 */
export default function BlockMidSide() {
  const [state, setState] = useState<MidSideState>(() =>
    midSideDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  useDeviceLoop({
    create: createMidSideEngine,
    destination: master,
    source: "groove",
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <MidSidePanel onValueChange={setState} value={state} />
    </div>
  );
}
