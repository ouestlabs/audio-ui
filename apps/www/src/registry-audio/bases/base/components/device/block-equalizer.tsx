import { useState } from "react";
import {
  type EqualizerState,
  equalizerDevice,
} from "@/registry-audio/bases/base/devices/equalizer/device";
import { createEqualizerEngine } from "@/registry-audio/bases/base/devices/equalizer/engine";
import { EqualizerPanel } from "@/registry-audio/bases/base/devices/equalizer/panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useSpectrum } from "@/registry-audio/bases/base/hooks/use-spectrum";

const MASTER_VOLUME = 0.7;
const MIN_HZ = 20;
const MAX_HZ = 20_000;
/** A shape worth looking at: some weight, a dip in the low mids, some air. */
const START = { highDb: 5, lowDb: 3, lowMidDb: -4 };

/**
 * An equalizer you can plug in: its state, a panel that draws it and an engine
 * that plays it, each its own file and none knowing the others. A loop
 * plays through it while its session's play switch is on, and the spectrum
 * behind the curve is what comes out.
 */
export default function BlockEqualizer() {
  const [state, setState] = useState<EqualizerState>(
    () => equalizerDevice.apply(equalizerDevice.defaults(), START).state
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { analyser } = useDeviceLoop({
    create: createEqualizerEngine,
    destination: master,
    state,
  });
  const spectrum = useSpectrum(analyser, { maxHz: MAX_HZ, minHz: MIN_HZ });

  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <EqualizerPanel
        onValueChange={setState}
        spectrum={spectrum}
        value={state}
      />
    </div>
  );
}
