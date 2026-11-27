import { useEffect, useMemo } from "react";
import type {
  DeviceContext,
  EffectEngine,
  EngineFactory,
} from "@/engine/device";
import { DEFAULT_TEMPO, type Tempo } from "@/engine/time";
import { useDeviceEngines } from "@/registry/bases/shared/hooks/devices/use-device-engines";
import { usePlaySwitch } from "@/registry/bases/shared/hooks/devices/use-play-switch";
import { webAudio } from "@/registry/lib/web-audio";

const SIGNAL_LEVEL = 0.8;
/** How far ahead of now the loop starts, in seconds: room for the first block. */
const START_AHEAD = 0.05;

/** A sound to loop through a device: the buffer that is heard, the one that feeds its sidechain, and their tempo. */
export interface DeviceLoopSound {
  buffer: AudioBuffer;
  /** Fed to the engine's `sidechain` input on the same beat, as a ducker's key: only listened to, never heard. */
  key?: AudioBuffer | null;
  /** The tempo of the sound, for a time parameter that syncs to it. */
  tempo: Tempo;
}

export interface UseDeviceLoopOptions<State, Engine> {
  /** Makes the engine for the state it starts with: an effect's `create<Name>Engine`. Made each time the loop starts. */
  create: EngineFactory<State, Engine>;
  /** Where the processed sound goes, such as the node of `useMasterBus`. */
  destination: AudioNode | null;
  /** The sound to loop through the engine, decoded by the app. Nothing plays while it is null. */
  sound: DeviceLoopSound | null;
  /** The state of the device, followed by the engine whoever changed it. */
  state: State;
}

/**
 * A sound looped through an effect's engine and out to a destination. It
 * plays while the play switch of its session is on (`usePlaySwitch`): the
 * button is the host's, so the device keeps none, and outside a session it is
 * silent.
 *
 * The engine is made when the loop starts and disposed when it stops
 * (`useDeviceEngines`), following `state` and the tempo of the sound, for a
 * time parameter that syncs to it. Returns whether it plays, that tempo, and
 * the engine: give it to `useDeviceSignal` for the panel's live sound.
 */
export function useDeviceLoop<State, Engine extends EffectEngine<State>>({
  create,
  destination,
  sound,
  state,
}: UseDeviceLoopOptions<State, Engine>) {
  const { playing } = usePlaySwitch();
  const tempo = sound?.tempo ?? DEFAULT_TEMPO;
  const context = useMemo<DeviceContext>(() => ({ tempo }), [tempo]);
  const [engine = null] = useDeviceEngines({
    context,
    create,
    destination: playing ? destination : null,
    state,
  });
  // The loop into the engine, made again for another sound.
  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(engine && ctx && sound)) {
      return;
    }
    // Resumed in the effect of the press that turned the switch on.
    webAudio.resume();
    const source = ctx.createBufferSource();
    source.buffer = sound.buffer;
    source.loop = true;
    const level = ctx.createGain();
    level.gain.value = SIGNAL_LEVEL;
    source.connect(level).connect(engine.input);
    // The key starts with the signal, on the same beat, and is not connected to the output.
    const key = sound.key && engine.sidechain ? ctx.createBufferSource() : null;
    if (key && sound.key && engine.sidechain) {
      key.buffer = sound.key;
      key.loop = true;
      key.connect(engine.sidechain);
    }
    const startAt = ctx.currentTime + START_AHEAD;
    source.start(startAt);
    key?.start(startAt);
    return () => {
      source.stop();
      key?.stop();
      for (const node of [source, key, level]) {
        node?.disconnect();
      }
    };
  }, [engine, sound]);

  return { engine, playing, tempo };
}
