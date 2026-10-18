"use client";

import { useState } from "react";
import { LimiterPanel } from "@/registry-audio/bases/base/audio/panels/limiter-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type LimiterState,
  limiterDevice,
} from "@/registry-audio/bases/base/lib/limiter-device";
import { createLimiterEngine } from "@/registry-audio/bases/base/lib/limiter-engine";

const MASTER_VOLUME = 0.7;

/**
 * A limiter you can plug in: its state, a panel that draws its transfer curve with a handle on the ceiling and an engine that plays it, each its own file. Play the loop, push the gain and pull the ceiling down.
 */
export default function BlockLimiter() {
  const [state, setState] = useState<LimiterState>(() =>
    limiterDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  useDeviceLoop({
    create: createLimiterEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <LimiterPanel onValueChange={setState} value={state} />
    </div>
  );
}
