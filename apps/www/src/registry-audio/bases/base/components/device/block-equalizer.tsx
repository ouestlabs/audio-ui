"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { Button } from "@/registry/bases/base/ui/button";
import { EqualizerPanel } from "@/registry-audio/bases/base/audio/panels/equalizer-panel";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useSpectrum } from "@/registry-audio/bases/base/hooks/use-spectrum";
import {
  type EqualizerState,
  equalizerDevice,
} from "@/registry-audio/bases/base/lib/equalizer-device";
import {
  createEqualizerEngine,
  type EqualizerEngine,
} from "@/registry-audio/bases/base/lib/equalizer-engine";
import { pinkNoise } from "@/registry-audio/bases/base/lib/pink-noise";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

const FFT_SIZE = 4096;
const ANALYSER_SMOOTHING = 0.8;
const NOISE_GAIN = 0.12;
const MASTER_VOLUME = 0.7;
const MIN_HZ = 20;
const MAX_HZ = 20_000;
/** A shape worth looking at: some weight, a dip in the low mids, some air. */
const START = { highDb: 5, lowDb: 3, lowMidDb: -4 };

/**
 * An equalizer you can plug in: its state, a panel that draws it and an engine
 * that plays it, each its own file and none knowing the others. Play pink
 * noise through it and the spectrum behind the curve is what comes out.
 */
export default function BlockEqualizer() {
  const [state, setState] = useState<EqualizerState>(
    () => equalizerDevice.apply(equalizerDevice.defaults(), START).state
  );
  const [playing, setPlaying] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const master = useMasterBus(MASTER_VOLUME);
  const engine = useRef<EqualizerEngine | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const spectrum = useSpectrum(analyser, { maxHz: MAX_HZ, minHz: MIN_HZ });

  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(playing && ctx && master)) {
      return;
    }
    ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = pinkNoise(ctx);
    source.loop = true;
    const level = ctx.createGain();
    level.gain.value = NOISE_GAIN;
    const eq = createEqualizerEngine(ctx, stateRef.current);
    const tap = ctx.createAnalyser();
    tap.fftSize = FFT_SIZE;
    tap.smoothingTimeConstant = ANALYSER_SMOOTHING;
    source.connect(level).connect(eq.input);
    eq.output.connect(tap);
    eq.output.connect(master);
    engine.current = eq;
    source.start();
    setAnalyser(tap);
    return () => {
      source.stop();
      source.disconnect();
      level.disconnect();
      tap.disconnect();
      eq.dispose();
      engine.current = null;
      setAnalyser(null);
    };
  }, [master, playing]);

  // The engine follows the state, whoever changed it: a handle, a knob or a call.
  useEffect(() => {
    engine.current?.update(state);
  }, [state]);

  const togglePlaying = useCallback(() => setPlaying((on) => !on), []);

  return (
    <div className="h-full w-full min-w-0">
      <EqualizerPanel
        onValueChange={setState}
        spectrum={spectrum}
        value={state}
      >
        <Button
          aria-label={playing ? "Stop the noise" : "Play pink noise through it"}
          onClick={togglePlaying}
          size="icon-sm"
          variant="outline"
        >
          {playing ? (
            <IconPlaceholder
              hugeicons="PauseIcon"
              lucide="PauseIcon"
              phosphor="PauseIcon"
              remixicon="RiPauseLine"
              tabler="IconPlayerPause"
            />
          ) : (
            <IconPlaceholder
              hugeicons="PlayIcon"
              lucide="PlayIcon"
              phosphor="PlayIcon"
              remixicon="RiPlayLine"
              tabler="IconPlayerPlay"
            />
          )}
        </Button>
      </EqualizerPanel>
    </div>
  );
}
