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
import { DEMO_TEMPO } from "@/registry-audio/bases/base/lib/demo-loop";

const MASTER_VOLUME = 0.7;
/** The loop's own tempo, so a synced rate moves with its beat. */
/** Sways on the half note: one cycle every two beats of the loop. */
const START = { division: "1/2", sync: true };
const CONTEXT = { tempo: DEMO_TEMPO };

/**
 * An auto pan you can plug in: its state, a panel that draws the movement and an engine that plays it, each its own file. Play the loop, pick a waveform and switch to tremolo.
 */
export default function BlockAutoPan() {
  const [state, setState] = useState<AutoPanState>(
    () => autoPanDevice.apply(autoPanDevice.defaults(), START).state
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { playing, toggle } = useDeviceLoop({
    context: CONTEXT,
    create: createAutoPanEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <AutoPanPanel onValueChange={setState} tempo={DEMO_TEMPO} value={state}>
        <PlayToggle
          label="Play a loop through it"
          onToggle={toggle}
          playing={playing}
        />
      </AutoPanPanel>
    </div>
  );
}
