"use client";

import type { DeviceContext } from "@audio-ui/core/device";
import { useEffect, useMemo, useState } from "react";
import { useDemoSource } from "@/registry-audio/bases/base/hooks/use-demo-source";
import { useDeviceEngines } from "@/registry-audio/bases/base/hooks/use-device-engines";
import { usePlaySwitch } from "@/registry-audio/bases/base/hooks/use-play-switch";
import {
  type DemoSourceName,
  demoKey,
  demoTempo,
  renderDemoSource,
} from "@/registry-audio/bases/base/lib/demo-sound";
import type {
  EffectEngine,
  EngineFactory,
} from "@/registry-audio/bases/base/lib/device-engine";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

const FFT_SIZE = 4096;
const ANALYSER_SMOOTHING = 0.8;
const SIGNAL_LEVEL = 0.8;
/** How far ahead of now the loop starts, in seconds: room for the first block. */
const START_AHEAD = 0.05;

export interface UseDeviceLoopOptions<State, Engine> {
  /** Makes the engine for the state it starts with: an effect's `create<Name>Engine`. Made each time the loop starts. */
  create: EngineFactory<State, Engine>;
  /** Where the processed sound goes, such as the node of `useMasterBus`. */
  destination: AudioNode | null;
  /** Whether the engine's `sidechain` input is fed, as a ducker's is: with the kick that goes with the sound that plays. It is only listened to, never heard. */
  key?: boolean;
  /** The sound to process, unless the session has another chosen: one of `DEMO_SOURCES`. @default "groove" */
  source?: DemoSourceName;
  /** The state of the device, followed by the engine whoever changed it. */
  state: State;
}

/** An analyser of what `node` sends, for a meter or a spectrum: never heard. */
function tap(node: AudioNode) {
  const analyser = node.context.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = ANALYSER_SMOOTHING;
  node.connect(analyser);
  return analyser;
}

/**
 * A short loop of drums and plucked notes played through an effect's engine
 * and out to a destination, for a block to show what a device does. It plays
 * while the play switch of its session is on (`usePlaySwitch`): the button is
 * the host's, so the device keeps none, and outside a session it is silent.
 *
 * The engine is made when the loop starts and disposed when it stops
 * (`useDeviceEngines`), following `state` and the tempo of the sound it
 * plays, for a time parameter that syncs to it. Returns whether it plays,
 * that tempo, the engine (to read what it measures, such as a gain
 * reduction), and analysers of what goes in (`input`, at the level the engine
 * hears it) and of what comes out (`analyser`), for a meter or a spectrum.
 */
export function useDeviceLoop<State, Engine extends EffectEngine<State>>({
  create,
  destination,
  key,
  source: wanted = "groove",
  state,
}: UseDeviceLoopOptions<State, Engine>) {
  const { playing } = usePlaySwitch();
  const name = useDemoSource(wanted);
  const tempo = demoTempo(name);
  const context = useMemo<DeviceContext>(() => ({ tempo }), [tempo]);
  const [engine = null] = useDeviceEngines({
    context,
    create,
    destination: playing ? destination : null,
    state,
  });
  const [input, setInput] = useState<AnalyserNode | null>(null);
  const [output, setOutput] = useState<AnalyserNode | null>(null);

  // What comes out is tapped for as long as the engine lives: disposing it takes the tap away.
  useEffect(() => {
    if (!engine) {
      return;
    }
    const analyser = tap(engine.output);
    setOutput(analyser);
    return () => {
      analyser.disconnect();
      setOutput(null);
    };
  }, [engine]);

  // The loop into the engine, made again for another sound or key.
  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(engine && ctx)) {
      return;
    }
    let cancelled = false;
    let stop = () => undefined;
    // Resumed in the effect of the press that turned the switch on.
    ctx.resume();
    Promise.all([
      renderDemoSource(name, ctx.sampleRate),
      key ? renderDemoSource(demoKey(name), ctx.sampleRate) : null,
    ]).then(([buffer, keyBuffer]) => {
      if (cancelled) {
        return;
      }
      const sound = ctx.createBufferSource();
      sound.buffer = buffer;
      sound.loop = true;
      const level = ctx.createGain();
      level.gain.value = SIGNAL_LEVEL;
      sound.connect(level).connect(engine.input);
      const heard = tap(level);
      // The key starts with the signal, on the same beat, and is not connected to the output.
      const keySound =
        keyBuffer && engine.sidechain ? ctx.createBufferSource() : null;
      if (keySound && keyBuffer && engine.sidechain) {
        keySound.buffer = keyBuffer;
        keySound.loop = true;
        keySound.connect(engine.sidechain);
      }
      const startAt = ctx.currentTime + START_AHEAD;
      sound.start(startAt);
      keySound?.start(startAt);
      setInput(heard);
      stop = () => {
        sound.stop();
        keySound?.stop();
        for (const node of [sound, keySound, level, heard]) {
          node?.disconnect();
        }
      };
    });
    return () => {
      cancelled = true;
      stop();
      setInput(null);
    };
  }, [engine, key, name]);

  return {
    analyser: output,
    engine,
    input,
    playing,
    tempo,
  };
}
