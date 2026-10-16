"use client";

import { useState } from "react";
import { PlayToggle } from "@/registry-audio/bases/base/audio/elements/play-toggle";
import { MultibandPanel } from "@/registry-audio/bases/base/audio/panels/multiband-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type MultibandState,
  multibandDevice,
} from "@/registry-audio/bases/base/lib/multiband-device";
import { createMultibandEngine } from "@/registry-audio/bases/base/lib/multiband-engine";

const MASTER_VOLUME = 0.7;

/**
 * A multiband compressor you can plug in: its state, a panel that draws the
 * three bands and an engine that plays it, each its own file and none knowing
 * the others. Play the loop, lower the threshold of one band and only that
 * band is held down.
 */
export default function BlockMultiband() {
  const [state, setState] = useState<MultibandState>(() =>
    multibandDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { playing, toggle } = useDeviceLoop({
    create: createMultibandEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <MultibandPanel onValueChange={setState} value={state}>
        <PlayToggle
          label="Play a loop through it"
          onToggle={toggle}
          playing={playing}
        />
      </MultibandPanel>
    </div>
  );
}
