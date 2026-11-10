"use client";

import { useState } from "react";
import {
  type FrequencyShifterState,
  frequencyShifterDevice,
} from "@/registry-audio/bases/base/devices/frequency-shifter/device";
import { createFrequencyShifterEngine } from "@/registry-audio/bases/base/devices/frequency-shifter/engine";
import { FrequencyShifterPanel } from "@/registry-audio/bases/base/devices/frequency-shifter/panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";

const MASTER_VOLUME = 0.7;

/**
 * A frequency shifter you can plug in: its state, a panel that draws what it
 * does to a note and its harmonics and an engine that plays it, each its own
 * file and none knowing the others. Play the loop and turn the shift.
 */
export default function BlockFrequencyShifter() {
  const [state, setState] = useState<FrequencyShifterState>(() =>
    frequencyShifterDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  useDeviceLoop({
    create: createFrequencyShifterEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <FrequencyShifterPanel onValueChange={setState} value={state} />
    </div>
  );
}
