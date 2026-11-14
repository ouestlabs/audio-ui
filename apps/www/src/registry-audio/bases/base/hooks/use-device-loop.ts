import type {
  DeviceContext,
  EffectEngine,
  EngineFactory,
} from "@audio-ui/engine/device";
import { useEffect, useMemo } from "react";
import { useDemoSource } from "@/registry-audio/bases/base/hooks/use-demo-source";
import { useDeviceEngines } from "@/registry-audio/bases/base/hooks/use-device-engines";
import { usePlaySwitch } from "@/registry-audio/bases/base/hooks/use-play-switch";
import {
  type DemoSourceName,
  demoKey,
  demoTempo,
  renderDemoSource,
} from "@/registry-audio/bases/base/lib/demo-sound";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

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

/**
 * A short loop of drums and plucked notes played through an effect's engine
 * and out to a destination, for a block to show what a device does. It plays
 * while the play switch of its session is on (`usePlaySwitch`): the button is
 * the host's, so the device keeps none, and outside a session it is silent.
 *
 * The engine is made when the loop starts and disposed when it stops
 * (`useDeviceEngines`), following `state` and the tempo of the sound it
 * plays, for a time parameter that syncs to it. Returns whether it plays,
 * that tempo, and the engine: give it to `useDeviceSignal` for the panel's
 * live sound.
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
  // The loop into the engine, made again for another sound or key.
  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(engine && ctx)) {
      return;
    }
    let cancelled = false;
    let stop = () => undefined;
    // Resumed in the effect of the press that turned the switch on.
    webAudio.resume();
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
      stop = () => {
        sound.stop();
        keySound?.stop();
        for (const node of [sound, keySound, level]) {
          node?.disconnect();
        }
      };
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [engine, key, name]);

  return { engine, playing, tempo };
}
