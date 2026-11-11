import type { NoteTiming } from "@audio-ui/core/device";
import {
  bodyDecibels,
  decaySeconds,
  type GuitarNote,
  type GuitarState,
  muteShare,
  toneHertz,
  volumeGain,
} from "@/registry-audio/bases/base/devices/guitar/device";
import type { InstrumentEngine } from "@/registry-audio/bases/base/lib/device-engine";

/** What a string is brought to: picked hard, its attack peaks near -12 dB before the volume, where the pick's burst is loudest. */
const STRING_GAIN = 0.3;
/** What a string is lifted by on its way out, +6 dB: one string plays alone, where a strum sums six. As loud as the registry's other instruments for the same volume. */
const VOICE_GAIN = 2;
/** The fretting hand lifting off: how fast the string falls silent, as a time constant, in seconds. */
const RELEASE = 0.03;
/** The longest a string rings, in seconds, whatever its decay. */
const LONGEST = 8;
/** Where the body resonates, and how wide. */
const BODY_HERTZ = 180;
const BODY_Q = 1.1;
const SMOOTHING = 0.03;

export type GuitarEngine = InstrumentEngine<GuitarState, GuitarNote>;

interface Voice {
  amp: GainNode;
  id: NoteTiming["id"];
  source: AudioBufferSourceNode;
}

/**
 * One plucked string, as samples at `sampleRate`: the pick, a burst of noise
 * softer the gentler it is, round a delay line whose every pass averages two
 * neighbours and loses a little, so the highs die first. The average delays
 * by half a sample and the line reads between samples, so the string is in
 * tune to the cent; how much it loses a pass sets how long it rings.
 */
export function stringSamples({
  frequency,
  ring,
  sampleRate,
  seconds,
  velocity,
}: {
  frequency: number;
  /** How long it takes to fall 60 dB, in seconds. */
  ring: number;
  sampleRate: number;
  seconds: number;
  velocity: number;
}): Float32Array<ArrayBuffer> {
  const delay = Math.max(2, sampleRate / frequency - 0.5);
  const whole = Math.floor(delay);
  const part = delay - whole;
  const length = Math.max(1, Math.round(seconds * sampleRate));
  const seed = whole + 2;
  const line = new Float32Array(seed + length);
  // A gentle pick is a softer burst: fewer highs in it.
  const softness = 0.3 + 0.5 * velocity;
  let soft = 0;
  for (let index = 0; index < seed; index += 1) {
    soft += (Math.random() * 2 - 1 - soft) * softness;
    line[index] = soft;
  }
  // Each round trip of the string, its level falls by what brings it 60 dB down in `ring` seconds.
  const loss = Math.min(0.9995, 10 ** (-3 / (ring * frequency)));
  const at = (index: number) =>
    (1 - part) * (line[index] ?? 0) + part * (line[index - 1] ?? 0);
  for (let index = seed; index < seed + length; index += 1) {
    line[index] = loss * 0.5 * (at(index - whole) + at(index - whole - 1));
  }
  return line.subarray(seed);
}

/**
 * One string of the Guitar on the Web Audio API, for a `GuitarState`:
 *
 * ```
 * the string, picked (drawn when the note comes) → amp ─┐
 * body (a bell at its resonance) → tone (low-pass) → output (volume)
 * ```
 *
 * A host plays chords with several of them, one note each. A note picks the
 * string at its pitch, louder and brighter the higher its velocity; it rings
 * for the decay, shortened by the palm mute, however long the note is held.
 * Let go, the fretting hand lifts off and the string falls silent at once. A
 * note while one sounds cuts it and picks anew. The tone, the body and the
 * volume move a ringing string; the decay and the mute take the next.
 */
export function createGuitarEngine(
  ctx: BaseAudioContext,
  initial: GuitarState
): GuitarEngine {
  let state = initial;
  let voice: Voice | null = null;

  const smooth = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, SMOOTHING);
  const when = (at?: number) => Math.max(ctx.currentTime, at ?? 0);

  const bus = ctx.createGain();
  const body = ctx.createBiquadFilter();
  body.type = "peaking";
  body.frequency.value = BODY_HERTZ;
  body.Q.value = BODY_Q;
  body.gain.value = bodyDecibels(initial.body);
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = toneHertz(initial.tone);
  tone.Q.value = 0.5;
  const output = ctx.createGain();
  output.gain.value = volumeGain(initial.volume) * VOICE_GAIN;
  bus.connect(body).connect(tone).connect(output);

  const release = (held: Voice, time: number) => {
    held.amp.gain.cancelScheduledValues(time);
    held.amp.gain.setTargetAtTime(0, time, RELEASE);
    held.source.stop(time + RELEASE * 8);
  };

  const pick = (note: GuitarNote, id: Voice["id"], time: number): Voice => {
    const velocity = note.velocity ?? 1;
    const ring = decaySeconds(state.decay) * muteShare(state.mute);
    const samples = stringSamples({
      frequency: note.frequency,
      ring,
      sampleRate: ctx.sampleRate,
      seconds: Math.min(LONGEST, ring + 0.1),
      velocity,
    });
    const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buffer.copyToChannel(samples, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const amp = ctx.createGain();
    amp.gain.value = STRING_GAIN * (0.35 + 0.65 * velocity);
    source.connect(amp).connect(bus);
    source.onended = () => {
      source.disconnect();
      amp.disconnect();
    };
    source.start(time);
    return { amp, id, source };
  };

  return {
    dispose: () => {
      voice?.source.stop();
      voice = null;
      output.disconnect();
    },
    noteOff: ({ at, id } = {}) => {
      if (
        !voice ||
        (id !== undefined && voice.id !== undefined && id !== voice.id)
      ) {
        return;
      }
      release(voice, when(at));
      voice = null;
    },
    noteOn: (note, { at, id } = {}) => {
      const time = when(at);
      if (voice) {
        release(voice, time);
      }
      voice = pick(note, id, time);
    },
    output,
    update: (next) => {
      state = next;
      smooth(output.gain, volumeGain(next.volume) * VOICE_GAIN);
      smooth(tone.frequency, toneHertz(next.tone));
      smooth(body.gain, bodyDecibels(next.body));
    },
  };
}
