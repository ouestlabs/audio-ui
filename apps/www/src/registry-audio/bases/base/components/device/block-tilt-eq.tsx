"use client";

import { useState } from "react";
import {
  type TiltEqState,
  tiltEqDevice,
} from "@/registry-audio/bases/base/devices/tilt-eq/device";
import { createTiltEqEngine } from "@/registry-audio/bases/base/devices/tilt-eq/engine";
import { TiltEqPanel } from "@/registry-audio/bases/base/devices/tilt-eq/panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A tilt EQ you can plug in: its state, a panel that draws the curve it tilts
 * and an engine that plays it, each its own file and none knowing the others.
 * Play the loop and turn the tilt: brighter one way, darker the other.
 */
export default function BlockTiltEq() {
  const [state, setState] = useState<TiltEqState>(() =>
    tiltEqDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  useDeviceLoop({
    create: createTiltEqEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <TiltEqPanel onValueChange={setState} value={state} />
    </div>
  );
}
