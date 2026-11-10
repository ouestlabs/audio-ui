"use client";

import { useState } from "react";
import {
  type WahState,
  wahDevice,
} from "@/registry-audio/bases/base/devices/wah/device";
import { createWahEngine } from "@/registry-audio/bases/base/devices/wah/engine";
import { WahPanel } from "@/registry-audio/bases/base/devices/wah/panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A wah you can plug in: its state, a panel that draws the band and its
 * travel and an engine that plays it, each its own file and none knowing the
 * others. Play the loop: the louder the hit, the higher the band.
 */
export default function BlockWah() {
  const [state, setState] = useState<WahState>(() => wahDevice.defaults());
  const master = useMasterBus(MASTER_VOLUME);
  useDeviceLoop({
    create: createWahEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <WahPanel onValueChange={setState} value={state} />
    </div>
  );
}
