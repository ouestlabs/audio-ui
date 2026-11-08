"use client";

import { useState } from "react";
import { VibePanel } from "@/registry-audio/bases/base/audio/panels/vibe-panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type VibeState,
  vibeDevice,
} from "@/registry-audio/bases/base/lib/vibe-device";
import { createVibeEngine } from "@/registry-audio/bases/base/lib/vibe-engine";

const MASTER_VOLUME = 0.7;

/**
 * A photocell vibe you can plug in: its state, a panel that draws the lamp and an engine that plays it, each its own file. Play the loop, switch between chorus and vibrato and turn the speed and the intensity.
 */
export default function BlockVibe() {
  const [state, setState] = useState<VibeState>(() => vibeDevice.defaults());
  const master = useMasterBus(MASTER_VOLUME);
  useDeviceLoop({
    create: createVibeEngine,
    destination: master,
    state,
  });
  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <VibePanel onValueChange={setState} value={state} />
    </div>
  );
}
