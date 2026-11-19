import { useState } from "react";
import {
  type PhaserState,
  phaserDevice,
} from "@/registry/bases/shared/devices/phaser/device";
import { createPhaserEngine } from "@/registry/bases/shared/devices/phaser/engine";
import { PhaserPanel } from "@/registry/bases/shared/devices/phaser/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/devices/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A phaser and flanger you can plug in: its state, a panel that draws the sweep and an engine that plays it, each its own file. Play the loop, switch the mode and turn the rate and the feedback.
 */
export default function BlockPhaser() {
  const [state, setState] = useState<PhaserState>(() =>
    phaserDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { engine, tempo } = useDeviceLoop({
    create: createPhaserEngine,
    destination: master,
    state,
  });
  const signal = useDeviceSignal(engine, phaserDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <PhaserPanel
        onValueChange={setState}
        signal={signal}
        tempo={tempo}
        value={state}
      />
    </div>
  );
}
