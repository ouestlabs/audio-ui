"use client";

import { useState } from "react";
import { PlayToggle } from "@/registry-audio/bases/base/audio/elements/play-toggle";
import { ChannelEqPanel } from "@/registry-audio/bases/base/audio/panels/channel-eq-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useSpectrum } from "@/registry-audio/bases/base/hooks/use-spectrum";
import {
  type ChannelEqState,
  channelEqDevice,
} from "@/registry-audio/bases/base/lib/channel-eq-device";
import { createChannelEqEngine } from "@/registry-audio/bases/base/lib/channel-eq-engine";

const MASTER_VOLUME = 0.7;
const MIN_HZ = 20;
const MAX_HZ = 20_000;

/**
 * A channel EQ you can plug in: its state, a panel that draws the curve it
 * plays with a handle on the mid band and an engine that plays it, each its
 * own file and none knowing the others. Play the loop and drag the handle: the
 * spectrum behind is what comes out.
 */
export default function BlockChannelEq() {
  const [state, setState] = useState<ChannelEqState>(() =>
    channelEqDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { analyser, playing, toggle } = useDeviceLoop({
    create: createChannelEqEngine,
    destination: master,
    state,
  });
  const spectrum = useSpectrum(analyser, { maxHz: MAX_HZ, minHz: MIN_HZ });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <ChannelEqPanel
        onValueChange={setState}
        spectrum={spectrum}
        value={state}
      >
        <PlayToggle
          label="Play a loop through it"
          onToggle={toggle}
          playing={playing}
        />
      </ChannelEqPanel>
    </div>
  );
}
