"use client";

import { useState } from "react";
import { PlayToggle } from "@/registry-audio/bases/base/audio/elements/play-toggle";
import { AutoPanPanel } from "@/registry-audio/bases/base/audio/panels/auto-pan-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type AutoPanState,
  autoPanDevice,
} from "@/registry-audio/bases/base/lib/auto-pan-device";
import { createAutoPanEngine } from "@/registry-audio/bases/base/lib/auto-pan-engine";

const MASTER_VOLUME = 0.7;

/**
 * An auto pan you can plug in: its state, a panel that draws the movement and an engine that plays it, each its own file. Play the loop, pick a waveform and switch to tremolo.
 */
export default function BlockAutoPan() {
  const [state, setState] = useState<AutoPanState>(() =>
    autoPanDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { playing, toggle } = useDeviceLoop({
    create: createAutoPanEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <AutoPanPanel onValueChange={setState} value={state}>
        <PlayToggle
          label="Play a loop through it"
          onToggle={toggle}
          playing={playing}
        />
      </AutoPanPanel>
    </div>
  );
}
