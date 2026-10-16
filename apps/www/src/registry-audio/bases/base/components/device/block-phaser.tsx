"use client";

import { useState } from "react";
import { PlayToggle } from "@/registry-audio/bases/base/audio/elements/play-toggle";
import { PhaserPanel } from "@/registry-audio/bases/base/audio/panels/phaser-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type PhaserState,
  phaserDevice,
} from "@/registry-audio/bases/base/lib/phaser-device";
import { createPhaserEngine } from "@/registry-audio/bases/base/lib/phaser-engine";

const MASTER_VOLUME = 0.7;

/**
 * A phaser and flanger you can plug in: its state, a panel that draws the sweep and an engine that plays it, each its own file. Play the loop, switch the mode and turn the rate and the feedback.
 */
export default function BlockPhaser() {
  const [state, setState] = useState<PhaserState>(() =>
    phaserDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { playing, toggle } = useDeviceLoop({
    create: createPhaserEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <PhaserPanel onValueChange={setState} value={state}>
        <PlayToggle
          label="Play a loop through it"
          onToggle={toggle}
          playing={playing}
        />
      </PhaserPanel>
    </div>
  );
}
