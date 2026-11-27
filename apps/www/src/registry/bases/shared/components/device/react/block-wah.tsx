import { useState } from "react";
import {
  type WahState,
  wahDevice,
} from "@/registry/bases/shared/devices/wah/device";
import { createWahEngine } from "@/registry/bases/shared/devices/wah/engine";
import { WahPanel } from "@/registry/bases/shared/devices/wah/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { useDemoSound } from "@/registry/bases/shared/hooks/use-demo-source";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/devices/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A wah you can plug in: its state, a panel that draws the band and its
 * travel and an engine that plays it, each its own file and none knowing the
 * others. Play the loop: the louder the hit, the higher the band.
 */
export default function BlockWah() {
  const [state, setState] = useState<WahState>(() => wahDevice.defaults());
  const master = useMasterBus(MASTER_VOLUME);
  const sound = useDemoSound("groove");
  const { engine } = useDeviceLoop({
    create: createWahEngine,
    destination: master,
    sound,
    state,
  });
  const signal = useDeviceSignal(engine, wahDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <WahPanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
