import type { DeviceContext, EffectEngine } from "@audio-ui/engine/device";
import { createFeed, type Feed } from "@audio-ui/engine/device";
import { DEFAULT_TEMPO } from "@audio-ui/engine/time";
import { loadWorklet } from "@audio-ui/engine/worklet";
import {
  CHORUS_WORKLET,
  type ChorusState,
  chorusSettings,
} from "@/components/audio-ui/devices/chorus/device";

const RAMP_SECONDS = 0.03;

export interface ChorusEngine extends EffectEngine<ChorusState> {
  /** Resolves once the voices are in the graph. Until then the chorus plays one. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
}

/**
 * A chorus on the Web Audio API for a `ChorusState`:
 *
 * ```
 * input → dry ──────────────────────────────┐
 *       → delay → wet ──────────────────────┤
 *           ↑ sweep ← oscillator (the rate) │
 *       → voices (worklet) → voices wet ────┴→ output
 * ```
 *
 * One voice is the delay, the oscillator's output, scaled by the sweep, added
 * to its time. Two to eight are an `AudioWorklet` loaded from a blob, fed only
 * while they play: until it is ready, the chorus plays one voice.
 */
export function createChorusEngine(
  ctx: BaseAudioContext,
  initial: ChorusState,
  context?: DeviceContext
): ChorusEngine {
  let tempo = context?.tempo ?? DEFAULT_TEMPO;
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const delay = ctx.createDelay(0.1);
  const oscillator = ctx.createOscillator();
  const sweep = ctx.createGain();
  const voicesWet = ctx.createGain();
  oscillator.type = "sine";
  input.connect(dry).connect(output);
  input.connect(delay).connect(wet).connect(output);
  oscillator.connect(sweep).connect(delay.delayTime);
  voicesWet.connect(output);

  let voices: AudioWorkletNode | null = null;
  let latest = initial;
  let disposed = false;
  let feed: Feed | null = null;

  const set = (
    state: ChorusState,
    write: (param: AudioParam, value: number) => void
  ) => {
    const settings = chorusSettings(state, tempo);
    // Until the worklet is ready, the chorus plays one voice.
    const playing = settings.voices > 1 && voices !== null;
    write(delay.delayTime, settings.delay);
    write(oscillator.frequency, settings.rate);
    write(sweep.gain, settings.sweep);
    write(dry.gain, settings.dry);
    write(wet.gain, playing ? 0 : settings.wet);
    write(voicesWet.gain, playing ? settings.wet : 0);
    if (voices) {
      const param = (name: string) =>
        voices?.parameters.get(name) as AudioParam;
      write(param("rate"), settings.rate);
      write(param("depth"), settings.share);
      // A new line, not a glide: they change at once, and the worklet fades them in.
      param("delay").value = settings.delay;
      param("voices").value = settings.voices;
    }
    feed?.set(playing);
  };
  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);
  set(initial, (param, value) => {
    param.value = value;
  });
  oscillator.start();

  const ready = loadWorklet(ctx, CHORUS_WORKLET).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    const settings = chorusSettings(latest, tempo);
    voices = new AudioWorkletNode(ctx, "audioui-chorus", {
      outputChannelCount: [2],
      parameterData: {
        delay: settings.delay,
        depth: settings.share,
        rate: settings.rate,
        voices: settings.voices,
      },
    });
    feed = createFeed([[input, voices]]);
    voices.connect(voicesWet);
    set(latest, follow);
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      feed?.dispose();
      oscillator.stop();
      for (const node of [
        input,
        dry,
        delay,
        wet,
        sweep,
        oscillator,
        voicesWet,
        output,
      ]) {
        node.disconnect();
      }
      voices?.disconnect();
    },
    input,
    output,
    ready,
    update: (state, next) => {
      tempo = next?.tempo ?? tempo;
      latest = state;
      set(state, follow);
    },
  };
}
