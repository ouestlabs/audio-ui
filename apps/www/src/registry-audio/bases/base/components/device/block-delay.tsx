"use client";

import { useState } from "react";
import { PlayToggle } from "@/registry-audio/bases/base/audio/elements/play-toggle";
import { DelayPanel } from "@/registry-audio/bases/base/audio/panels/delay-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type DelayState,
  delayDevice,
} from "@/registry-audio/bases/base/lib/delay-device";
import { createDelayEngine } from "@/registry-audio/bases/base/lib/delay-engine";

const MASTER_VOLUME = 0.7;

/**
 * A delay you can plug in: its state, a panel that draws the echoes it makes
 * and an engine that plays it, each its own file and none knowing the others.
 * Play the loop and drag the handle: across for the time, up for the feedback.
 */
export default function BlockDelay() {
  const [state, setState] = useState<DelayState>(() => delayDevice.defaults());
  const master = useMasterBus(MASTER_VOLUME);
  const { playing, toggle } = useDeviceLoop({
    create: createDelayEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <DelayPanel onValueChange={setState} value={state}>
        <PlayToggle
          label="Play a loop through it"
          onToggle={toggle}
          playing={playing}
        />
      </DelayPanel>
    </div>
  );
}
