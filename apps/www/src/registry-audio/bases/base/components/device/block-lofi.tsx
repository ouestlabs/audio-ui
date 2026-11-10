"use client";

import { useState } from "react";
import {
  type LofiState,
  lofiDevice,
} from "@/registry-audio/bases/base/devices/lofi/device";
import { createLofiEngine } from "@/registry-audio/bases/base/devices/lofi/engine";
import { LofiPanel } from "@/registry-audio/bases/base/devices/lofi/panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A lo-fi you can plug in: its state, a panel that draws the band it leaves
 * and an engine that plays it, each its own file and none knowing the others.
 * Play the loop and turn up the wow and the crackle: it ages like a worn tape.
 */
export default function BlockLofi() {
  const [state, setState] = useState<LofiState>(() => lofiDevice.defaults());
  const master = useMasterBus(MASTER_VOLUME);
  useDeviceLoop({
    create: createLofiEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <LofiPanel onValueChange={setState} value={state} />
    </div>
  );
}
