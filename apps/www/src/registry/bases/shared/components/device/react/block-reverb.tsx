import { useState } from "react";
import {
  type ReverbState,
  reverbDevice,
} from "@/registry/bases/shared/devices/reverb/device";
import { createReverbEngine } from "@/registry/bases/shared/devices/reverb/engine";
import { ReverbPanel } from "@/registry/bases/shared/devices/reverb/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { useDemoSound } from "@/registry/bases/shared/hooks/use-demo-source";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/devices/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";

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
  const sound = useDemoSound("groove");
  const { engine } = useDeviceLoop({
    create: createReverbEngine,
    destination: master,
    sound,
    state,
  });
  const signal = useDeviceSignal(engine, reverbDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <ReverbPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
