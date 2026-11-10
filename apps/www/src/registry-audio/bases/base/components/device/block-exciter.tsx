"use client";

import { useState } from "react";
import {
  type ExciterState,
  exciterDevice,
} from "@/registry-audio/bases/base/devices/exciter/device";
import { createExciterEngine } from "@/registry-audio/bases/base/devices/exciter/engine";
import { ExciterPanel } from "@/registry-audio/bases/base/devices/exciter/panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * An exciter you can plug in: its state, a panel that draws the band it
 * excites and an engine that plays it, each its own file and none knowing the
 * others. Play the loop and raise the amount: it comes forward.
 */
export default function BlockExciter() {
  const [state, setState] = useState<ExciterState>(() =>
    exciterDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  useDeviceLoop({
    create: createExciterEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <ExciterPanel onValueChange={setState} value={state} />
    </div>
  );
}
