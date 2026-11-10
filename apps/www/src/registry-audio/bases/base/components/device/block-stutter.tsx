"use client";

import { useState } from "react";
import {
  type StutterState,
  stutterDevice,
} from "@/registry-audio/bases/base/devices/stutter/device";
import { createStutterEngine } from "@/registry-audio/bases/base/devices/stutter/engine";
import { StutterPanel } from "@/registry-audio/bases/base/devices/stutter/panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A stutter you can plug in: its state, a panel that draws one interval and
 * an engine that plays it, each its own file and none knowing the others. Play
 * the loop and switch it on: it catches a slice and repeats it.
 */
export default function BlockStutter() {
  const [state, setState] = useState<StutterState>(() =>
    stutterDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  useDeviceLoop({
    create: createStutterEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <StutterPanel onValueChange={setState} value={state} />
    </div>
  );
}
