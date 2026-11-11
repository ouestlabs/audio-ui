import type { DeviceContext } from "@audio-ui/core/device";
import { DEFAULT_TEMPO } from "@audio-ui/core/time";
import {
  DELAY_WORKLET,
  type DelayState,
  delaySettings,
  MAX_DELAY_SECONDS,
} from "@/registry-audio/bases/base/devices/delay/device";
import { loadWorklet } from "@/registry-audio/bases/base/lib/audio-worklet";

/** How fast a knob follows a change, as a time constant in seconds. */
const RAMP_SECONDS = 0.02;
/** A change of time glides slower, so the echo bends like a tape instead of clicking. */
const TIME_RAMP_SECONDS = 0.08;
/** How long after the worklet's modes fade out their input is taken away, in ms: the fade is over by then. */
const UNFEED_MS = 120;

export interface DelayEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the ping-pong, multitap and grain modes are in the graph. Until then they play the echo. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  update: (state: DelayState, context?: DeviceContext) => void;
}

/**
 * A delay on the Web Audio API for a `DelayState`:
 *
 * ```
 * input → dry ─────────────────────────────────────────────┐
 *       → delay → tone (low-pass) → echo ──┐               │
 *             ↑            └→ feedback ─┘  ├→ wet ─────────┴→ output
 *       → modes (worklet) → tone → modes ──┘
 * ```
 *
 * The echo's repeats go round the loop through the tone filter, so each is
 * darker than the one before. The ping-pong, multitap and grain modes are an
 * `AudioWorklet` loaded from a blob, fed only while one plays, its wet sound
 * through a tone filter of its own: until it is ready, they play the echo. A
 * change between the echo and the worklet fades one out as the other comes in.
 * A synced delay reads its note value at the tempo the host gave, the last one
 * it was given. Parameters move with `setTargetAtTime`, never `.value =`.
 */
export function createDelayEngine(
  ctx: BaseAudioContext,
  initial: DelayState,
  context?: DeviceContext
): DelayEngine {
  let tempo = context?.tempo ?? DEFAULT_TEMPO;
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const delay = ctx.createDelay(MAX_DELAY_SECONDS + 1);
  const tone = ctx.createBiquadFilter();
  const feedback = ctx.createGain();
  const echo = ctx.createGain();
  const modesTone = ctx.createBiquadFilter();
  const modesLevel = ctx.createGain();
  tone.type = "lowpass";
  modesTone.type = "lowpass";

  input.connect(dry).connect(output);
  input.connect(delay).connect(tone).connect(echo).connect(wet).connect(output);
  tone.connect(feedback).connect(delay);
  modesTone.connect(modesLevel).connect(wet);

  let modes: AudioWorkletNode | null = null;
  let latest = initial;
  let disposed = false;
  let routed = false;
  let fed = false;
  let sent = initial.mode;
  let unfeed: ReturnType<typeof setTimeout> | undefined;

  const apply = (
    state: DelayState,
    set: (param: AudioParam, value: number, ramp: number) => void
  ) => {
    const settings = delaySettings(state, tempo);
    set(delay.delayTime, settings.delay, TIME_RAMP_SECONDS);
    set(tone.frequency, settings.tone, RAMP_SECONDS);
    set(modesTone.frequency, settings.tone, RAMP_SECONDS);
    set(feedback.gain, settings.feedback, RAMP_SECONDS);
    set(dry.gain, settings.dry, RAMP_SECONDS);
    set(wet.gain, settings.wet, RAMP_SECONDS);
    if (modes) {
      const param = (name: string) => modes?.parameters.get(name) as AudioParam;
      set(param("time"), settings.delay, RAMP_SECONDS);
      set(param("feedback"), settings.feedback, RAMP_SECONDS);
      set(param("pitch"), settings.pitch, RAMP_SECONDS);
      set(param("spray"), settings.spray, RAMP_SECONDS);
      set(param("jitter"), settings.jitter, RAMP_SECONDS);
      set(param("grain"), settings.grain, RAMP_SECONDS);
    }
  };

  /** The worklet's path in when one of its modes plays and it is loaded, the echo when not. */
  const route = (state: DelayState) => {
    const playing = state.mode !== "echo" && modes !== null;
    if (modes && playing && state.mode !== sent) {
      sent = state.mode;
      modes.port.postMessage({ mode: state.mode });
    }
    if (playing === routed) {
      return;
    }
    routed = playing;
    echo.gain.setTargetAtTime(playing ? 0 : 1, ctx.currentTime, RAMP_SECONDS);
    modesLevel.gain.setTargetAtTime(
      playing ? 1 : 0,
      ctx.currentTime,
      RAMP_SECONDS
    );
    clearTimeout(unfeed);
    if (playing && !fed && modes) {
      input.connect(modes);
      fed = true;
    } else if (!playing && fed) {
      // Once the fade is over: a worklet fed nothing costs nothing.
      unfeed = setTimeout(() => {
        if (fed && modes) {
          input.disconnect(modes);
          fed = false;
        }
      }, UNFEED_MS);
    }
  };

  // A fresh node has its own defaults: set the first state outright, ramps come after.
  apply(initial, (param, value) => {
    param.value = value;
  });
  echo.gain.value = 1;
  modesLevel.gain.value = 0;

  const ready = loadWorklet(ctx, DELAY_WORKLET).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    modes = new AudioWorkletNode(ctx, "audioui-delay", {
      outputChannelCount: [2],
      processorOptions: {
        mode: latest.mode === "echo" ? "pingpong" : latest.mode,
      },
    });
    sent = latest.mode;
    modes.connect(modesTone);
    apply(latest, (param, value) => {
      param.value = value;
    });
    route(latest);
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      clearTimeout(unfeed);
      for (const node of [
        input,
        dry,
        delay,
        tone,
        feedback,
        echo,
        wet,
        modesTone,
        modesLevel,
        output,
      ]) {
        node.disconnect();
      }
      modes?.disconnect();
    },
    input,
    output,
    ready,
    update: (state, next) => {
      latest = state;
      tempo = next?.tempo ?? tempo;
      apply(state, (param, value, ramp) =>
        param.setTargetAtTime(value, ctx.currentTime, ramp)
      );
      route(state);
    },
  };
}
