import { useState } from "react";
import {
  type ChannelEqState,
  channelEqDevice,
} from "@/registry/bases/base/devices/channel-eq/device";
import { createChannelEqEngine } from "@/registry/bases/base/devices/channel-eq/engine";
import { ChannelEqPanel } from "@/registry/bases/base/devices/channel-eq/panel";
import { useDeviceLoop } from "@/registry/bases/base/hooks/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/base/hooks/use-device-signal";
import { useMasterBus } from "@/registry/bases/base/hooks/use-master-bus";

const MASTER_VOLUME = 0.7;

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
  const { engine } = useDeviceLoop({
    create: createChannelEqEngine,
    destination: master,
    state,
  });
  const signal = useDeviceSignal(engine, channelEqDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <ChannelEqPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
