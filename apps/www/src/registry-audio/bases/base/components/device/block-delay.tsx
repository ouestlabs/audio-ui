"use client";

import { useState } from "react";
import { DelayPanel } from "@/registry-audio/bases/base/audio/panels/delay-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type DelayState,
  delayDevice,
} from "@/registry-audio/bases/base/lib/delay-device";
import { createDelayEngine } from "@/registry-audio/bases/base/lib/delay-engine";
import { DEMO_TEMPO } from "@/registry-audio/bases/base/lib/demo-loop";

const MASTER_VOLUME = 0.7;
/** The loop's own tempo, so a synced delay echoes on its beat. */
const CONTEXT = { tempo: DEMO_TEMPO };
/** A dotted eighth: the echo that has made a thousand guitars sound larger. */
const START = { division: "1/8d", sync: true };

/**
 * A delay you can plug in: its state, a panel that draws the echoes it makes
 * and an engine that plays it, each its own file and none knowing the others.
 * Play the loop and drag the handle: across for the time, up for the feedback.
 * It starts synced to the loop's tempo, on a dotted eighth.
 */
export default function BlockDelay() {
  const [state, setState] = useState<DelayState>(
    () => delayDevice.apply(delayDevice.defaults(), START).state
  );
  const master = useMasterBus(MASTER_VOLUME);
  useDeviceLoop({
    context: CONTEXT,
    create: createDelayEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <DelayPanel onValueChange={setState} tempo={DEMO_TEMPO} value={state} />
    </div>
  );
}
