"use client";

import { useState } from "react";
import { PlayToggle } from "@/registry-audio/bases/base/audio/elements/play-toggle";
import { ReverbPanel } from "@/registry-audio/bases/base/audio/panels/reverb-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type ReverbState,
  reverbDevice,
} from "@/registry-audio/bases/base/lib/reverb-device";
import { createReverbEngine } from "@/registry-audio/bases/base/lib/reverb-engine";

const MASTER_VOLUME = 0.7;

/**
 * A reverb you can plug in: its state, a panel that draws the tail it makes
 * and an engine that plays it, each its own file and none knowing the others.
 * Play the loop and drag the handle along: the decay time.
 */
export default function BlockReverb() {
  const [state, setState] = useState<ReverbState>(() =>
    reverbDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { playing, toggle } = useDeviceLoop({
    create: createReverbEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <ReverbPanel onValueChange={setState} value={state}>
        <PlayToggle
          label="Play a loop through it"
          onToggle={toggle}
          playing={playing}
        />
      </ReverbPanel>
    </div>
  );
}
