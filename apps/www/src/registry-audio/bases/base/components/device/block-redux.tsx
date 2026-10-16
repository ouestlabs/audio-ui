"use client";

import { useState } from "react";
import { PlayToggle } from "@/registry-audio/bases/base/audio/elements/play-toggle";
import { ReduxPanel } from "@/registry-audio/bases/base/audio/panels/redux-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type ReduxState,
  reduxDevice,
} from "@/registry-audio/bases/base/lib/redux-device";
import { createReduxEngine } from "@/registry-audio/bases/base/lib/redux-engine";

const MASTER_VOLUME = 0.7;

/**
 * A redux you can plug in: its state, a panel that draws the stairs the bits
 * make and an engine that plays it, each its own file and none knowing the
 * others. Play the loop and take the bits down: the stairs grow as the sound
 * roughens.
 */
export default function BlockRedux() {
  const [state, setState] = useState<ReduxState>(() => reduxDevice.defaults());
  const master = useMasterBus(MASTER_VOLUME);
  const { playing, toggle } = useDeviceLoop({
    create: createReduxEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <ReduxPanel onValueChange={setState} value={state}>
        <PlayToggle
          label="Play a loop through it"
          onToggle={toggle}
          playing={playing}
        />
      </ReduxPanel>
    </div>
  );
}
