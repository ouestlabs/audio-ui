"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { renderDemoLoop } from "@/registry-audio/bases/base/lib/demo-loop";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

const FFT_SIZE = 4096;
const ANALYSER_SMOOTHING = 0.8;
const SIGNAL_LEVEL = 0.8;

/** What the demo needs of an effect's engine: a signal in, a signal out, the state followed, a way to let go. */
export interface DemoEngine<State> {
  dispose: () => void;
  readonly input: AudioNode;
  readonly output: AudioNode;
  update: (state: State) => void;
}

export interface UseDeviceLoopOptions<State, Engine extends DemoEngine<State>> {
  /** Makes the engine for the first state. Called each time the demo starts. */
  create: (ctx: BaseAudioContext, state: State) => Engine;
  /** Where the processed sound goes, such as the node of `useMasterBus`. */
  destination: AudioNode | null;
  /** The state of the device, followed by the engine whoever changed it. */
  state: State;
}

/**
 * A short loop of drums and plucked notes played through an effect's engine
 * and out to a destination, for a block to show what a device does. The engine
 * follows `state` while it plays. Returns whether it plays, how to start and
 * stop it, the engine (to read what it measures, such as a gain reduction),
 * and an analyser of what comes out, for a spectrum. Stops on unmount.
 */
export function useDeviceLoop<State, Engine extends DemoEngine<State>>({
  create,
  destination,
  state,
}: UseDeviceLoopOptions<State, Engine>) {
  const [playing, setPlaying] = useState(false);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const createRef = useRef(create);
  createRef.current = create;

  const toggle = useCallback(() => setPlaying((on) => !on), []);

  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(playing && ctx && destination)) {
      return;
    }
    let cancelled = false;
    let stop = () => undefined;
    ctx.resume();
    renderDemoLoop(ctx.sampleRate).then((buffer) => {
      if (cancelled) {
        return;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const level = ctx.createGain();
      level.gain.value = SIGNAL_LEVEL;
      const made = createRef.current(ctx, stateRef.current);
      const tap = ctx.createAnalyser();
      tap.fftSize = FFT_SIZE;
      tap.smoothingTimeConstant = ANALYSER_SMOOTHING;
      source.connect(level).connect(made.input);
      made.output.connect(tap);
      made.output.connect(destination);
      source.start();
      setEngine(made);
      setAnalyser(tap);
      stop = () => {
        source.stop();
        source.disconnect();
        level.disconnect();
        tap.disconnect();
        made.dispose();
      };
    });
    return () => {
      cancelled = true;
      stop();
      setEngine(null);
      setAnalyser(null);
    };
  }, [destination, playing]);

  // The engine follows the state, whoever changed it: a knob, a handle or a call.
  useEffect(() => {
    engine?.update(state);
  }, [engine, state]);

  return { analyser, engine, playing, toggle };
}
