import { useState } from "react";
import {
  type VibeState,
  vibeDevice,
} from "@/registry/bases/shared/devices/vibe/device";
import { createVibeEngine } from "@/registry/bases/shared/devices/vibe/engine";
import { VibePanel } from "@/registry/bases/shared/devices/vibe/panel";
import { useDeviceLoop } from "@/registry/bases/shared/hooks/devices/use-device-loop";
import { useDeviceSignal } from "@/registry/bases/shared/hooks/devices/use-device-signal";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A photocell vibe you can plug in: its state, a panel that draws the lamp and an engine that plays it, each its own file. Play the loop, switch between chorus and vibrato and turn the speed and the intensity.
 */
export default function BlockVibe() {
  const [state, setState] = useState<VibeState>(() => vibeDevice.defaults());
  const master = useMasterBus(MASTER_VOLUME);
  const { engine } = useDeviceLoop({
    create: createVibeEngine,
    destination: master,
    state,
  });
  const signal = useDeviceSignal(engine, vibeDevice);
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <VibePanel onValueChange={setState} signal={signal} value={state} />
    </div>
  );
}
