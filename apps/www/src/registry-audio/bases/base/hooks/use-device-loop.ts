"use client";

import type { DeviceContext } from "@audio-ui/core/device";
import { useEffect, useRef, useState } from "react";
import { usePlaySwitch } from "@/registry-audio/bases/base/hooks/use-play-switch";
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
  /** The key input of an engine that takes one, such as a gate. */
  readonly sidechain?: AudioNode;
  update: (state: State, context?: DeviceContext) => void;
}

export interface UseDeviceLoopOptions<State, Engine extends DemoEngine<State>> {
  /** Makes the engine for the first state. Called each time the demo starts. */
  /** What the host knows, such as the tempo of the loop, given to the engine and to each update. */
  context?: DeviceContext;
  create: (
    ctx: BaseAudioContext,
    state: State,
    context?: DeviceContext
  ) => Engine;
  /** Where the processed sound goes, such as the node of `useMasterBus`. */
  destination: AudioNode | null;
  /** The signal that goes to the engine's `sidechain` input, when it has one: a loop drawn for the sample rate. It is only listened to, never heard. */
  key?: (sampleRate: number) => Promise<AudioBuffer>;
  /** The signal to process, drawn for the sample rate. @default renderDemoLoop */
  signal?: (sampleRate: number) => Promise<AudioBuffer>;
  /** The state of the device, followed by the engine whoever changed it. */
  state: State;
}

/**
 * A short loop of drums and plucked notes played through an effect's engine
 * and out to a destination, for a block to show what a device does. It plays
 * while the play switch of its session is on (`usePlaySwitch`): the button is
 * the host's, so the device keeps none, and outside a session it is silent.
 * The engine follows `state` while it plays. Returns whether it plays, the
 * engine (to read what it measures, such as a gain reduction), and an
 * analyser of what comes out, for a spectrum. Stops on unmount.
 */
export function useDeviceLoop<State, Engine extends DemoEngine<State>>({
  context,
  create,
  destination,
  key,
  signal = renderDemoLoop,
  state,
}: UseDeviceLoopOptions<State, Engine>) {
  const { playing } = usePlaySwitch();
  const [engine, setEngine] = useState<Engine | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const contextRef = useRef(context);
  contextRef.current = context;
  const createRef = useRef(create);
  createRef.current = create;

  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(playing && ctx && destination)) {
      return;
    }
    let cancelled = false;
    let stop = () => undefined;
    ctx.resume();
    Promise.all([
      signal(ctx.sampleRate),
      key ? key(ctx.sampleRate) : Promise.resolve(null),
    ]).then(([buffer, keyBuffer]) => {
      if (cancelled) {
        return;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const level = ctx.createGain();
      level.gain.value = SIGNAL_LEVEL;
      const made = createRef.current(ctx, stateRef.current, contextRef.current);
      const tap = ctx.createAnalyser();
      tap.fftSize = FFT_SIZE;
      tap.smoothingTimeConstant = ANALYSER_SMOOTHING;
      source.connect(level).connect(made.input);
      made.output.connect(tap);
      made.output.connect(destination);
      // The key starts with the signal, on the same beat, and is not connected to the output.
      const keySource =
        keyBuffer && made.sidechain ? ctx.createBufferSource() : null;
      if (keySource && keyBuffer && made.sidechain) {
        keySource.buffer = keyBuffer;
        keySource.loop = true;
        keySource.connect(made.sidechain);
      }
      const startAt = ctx.currentTime + 0.05;
      source.start(startAt);
      keySource?.start(startAt);
      setEngine(made);
      setAnalyser(tap);
      stop = () => {
        source.stop();
        source.disconnect();
        keySource?.stop();
        keySource?.disconnect();
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
  }, [destination, key, playing, signal]);

  // The engine follows the state, whoever changed it: a knob, a handle or a call.
  useEffect(() => {
    engine?.update(state, context);
  }, [context, engine, state]);

  return { analyser, engine, playing };
}
