import type { EffectEngine } from "@audio-ui/engine/device";
import {
  type ReverbState,
  reverbImpulse,
  reverbSettings,
} from "@/registry-audio/bases/base/devices/reverb/device";

/** How fast a knob follows a change, as a time constant in seconds. */
const RAMP_SECONDS = 0.02;
/** How long a new room takes to take over from the old one, in seconds. */
const CROSSFADE_SECONDS = 0.08;
/** How long a knob rests before its room is made, in milliseconds: the impulse is a table of a few hundred thousand points, and a type other than the room takes tens of milliseconds to ring. */
const REBUILD_MS = 120;

export type ReverbEngine = EffectEngine<ReverbState>;

/**
 * A reverb on the Web Audio API for a `ReverbState`:
 *
 * ```
 * input → dry ─────────────────────────────────────────┐
 *       → pre-delay → room A or room B → wet ──────────┴→ output
 * ```
 *
 * The room is a convolver fed an impulse response made from the type, the
 * decay and the damping (`reverbImpulse`). A convolver cannot change its
 * impulse without a click, so there are two: a new room is loaded in the idle
 * one and the two cross-fade. The room is rebuilt once a knob has rested for
 * 120 ms.
 */
export function createReverbEngine(
  ctx: BaseAudioContext,
  initial: ReverbState
): ReverbEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const preDelay = ctx.createDelay(1);
  const rooms = [0, 1].map(() => {
    const convolver = ctx.createConvolver();
    const fade = ctx.createGain();
    preDelay.connect(convolver).connect(fade).connect(wet);
    return { convolver, fade };
  });
  input.connect(dry).connect(output);
  input.connect(preDelay);
  wet.connect(output);

  let active = 0;
  let built: Pick<ReverbState, "dampingHz" | "decay" | "type"> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest = initial;

  const load = (state: ReverbState, instant: boolean) => {
    const [left, right] = reverbImpulse(ctx.sampleRate, state);
    const next = instant ? active : 1 - active;
    const buffer = ctx.createBuffer(2, left.length, ctx.sampleRate);
    buffer.copyToChannel(left, 0);
    buffer.copyToChannel(right, 1);
    const room = rooms[next];
    const previous = rooms[active];
    if (!(room && previous)) {
      return;
    }
    room.convolver.buffer = buffer;
    if (instant) {
      room.fade.gain.value = 1;
      return;
    }
    room.fade.gain.setTargetAtTime(1, ctx.currentTime, CROSSFADE_SECONDS / 3);
    previous.fade.gain.setTargetAtTime(
      0,
      ctx.currentTime,
      CROSSFADE_SECONDS / 3
    );
    active = next;
  };

  const settle = (state: ReverbState) => {
    if (
      built &&
      built.decay === state.decay &&
      built.dampingHz === state.dampingHz &&
      built.type === state.type
    ) {
      return;
    }
    built = {
      dampingHz: state.dampingHz,
      decay: state.decay,
      type: state.type,
    };
    load(state, false);
  };

  // A fresh node has its own defaults: set the first state outright, ramps come after.
  const first = reverbSettings(initial);
  dry.gain.value = first.dry;
  wet.gain.value = first.wet;
  preDelay.delayTime.value = first.preDelay;
  rooms[1]?.fade.gain.setValueAtTime(0, 0);
  built = {
    dampingHz: initial.dampingHz,
    decay: initial.decay,
    type: initial.type,
  };
  load(initial, true);

  return {
    dispose: () => {
      clearTimeout(timer);
      for (const node of [input, dry, preDelay, wet, output]) {
        node.disconnect();
      }
      for (const room of rooms) {
        room.convolver.disconnect();
        room.fade.disconnect();
      }
    },
    input,
    output,
    update: (state) => {
      latest = state;
      const settings = reverbSettings(state);
      dry.gain.setTargetAtTime(settings.dry, ctx.currentTime, RAMP_SECONDS);
      wet.gain.setTargetAtTime(settings.wet, ctx.currentTime, RAMP_SECONDS);
      preDelay.delayTime.setTargetAtTime(
        settings.preDelay,
        ctx.currentTime,
        RAMP_SECONDS
      );
      clearTimeout(timer);
      timer = setTimeout(() => settle(latest), REBUILD_MS);
    },
  };
}
