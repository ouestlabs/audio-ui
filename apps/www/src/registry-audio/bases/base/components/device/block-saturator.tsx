"use client";

import { useState } from "react";
import { PlayToggle } from "@/registry-audio/bases/base/audio/elements/play-toggle";
import { SaturatorPanel } from "@/registry-audio/bases/base/audio/panels/saturator-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type SaturatorState,
  saturatorDevice,
} from "@/registry-audio/bases/base/lib/saturator-device";
import { createSaturatorEngine } from "@/registry-audio/bases/base/lib/saturator-engine";

const MASTER_VOLUME = 0.7;

/**
 * A saturator you can plug in: its state, a panel that draws its transfer
 * curve and an engine that plays it, each its own file and none knowing the
 * others. Play the loop, pick a curve and turn the drive: the curve bends as
 * the sound does.
 */
export default function BlockSaturator() {
  const [state, setState] = useState<SaturatorState>(() =>
    saturatorDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { playing, toggle } = useDeviceLoop({
    create: createSaturatorEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <SaturatorPanel onValueChange={setState} value={state}>
        <PlayToggle
          label="Play a loop through it"
          onToggle={toggle}
          playing={playing}
        />
      </SaturatorPanel>
    </div>
  );
}
