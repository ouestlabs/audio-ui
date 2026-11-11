import type { InstrumentBinding, NoteTiming } from "@audio-ui/engine/device";
import {
  speedCents,
  TAPE_KEYS_HIGHEST,
  TAPE_KEYS_LOWEST,
  TAPE_SECONDS,
  type TapeKeysNote,
  type TapeKeysState,
  toneHertz,
  volumeGain,
} from "@/components/audio-ui/devices/tape-keys/device";

type Track = TapeKeysState["station"];

/** What a key's tape plays at. */
const TAPE_GAIN = 0.09;
/** What a key is lifted by on its way out, +6 dB: a key plays alone, where a whole keyboard summed ten. As loud as the registry's other instruments for the same volume. */
const VOICE_GAIN = 2;
/** Each track's level, so the three sound alike in loudness. */
const TRACK_GAIN: Record<Track, number> = {
  choir: 3.4,
  flutes: 0.7,
  strings: 0.58,
};
/** How a recording starts, in seconds: a flute speaks quickly, a bow and a choir swell. */
const ATTACK: Record<Track, number> = {
  choir: 0.32,
  flutes: 0.06,
  strings: 0.26,
};
/** The players' vibrato: how fast, how deep in cents, and after how long it comes in. */
const VIBRATO: Record<Track, { cents: number; delay: number; hertz: number }> =
  {
    choir: { cents: 9, delay: 0.5, hertz: 5.1 },
    flutes: { cents: 13, delay: 0.35, hertz: 5.3 },
    strings: { cents: 8, delay: 0.3, hertz: 5.8 },
  };
/** The vowel the choir sings, "ah": its formants, how narrow, how loud. */
const AH = [
  { gain: 1, hertz: 720, q: 7 },
  { gain: 0.5, hertz: 1150, q: 9 },
  { gain: 0.22, hertz: 2600, q: 11 },
] as const;
/** The pads letting go of the tape, as a time constant, in seconds. */
const RELEASE = 0.05;
/** How the recording ends at the end of the strip: it fades this long before, over this time constant. */
const RUN_OUT = { before: 0.05, tau: 0.015 } as const;
const HISS_GAIN = 0.012;
/** How far the capstan's slow wow and quick flutter bend the pitch, at the top of the control, in cents. */
const MAX_WOW_CENTS = 16;
const MAX_FLUTTER_CENTS = 6;
const WOW_HERTZ = 0.55;
const FLUTTER_HERTZ = 6.7;
const SMOOTHING = 0.03;
const NOISE_SECONDS = 2;

export interface TapeKeysEngine
  extends InstrumentBinding<TapeKeysState, TapeKeysNote> {
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
}

interface Voice {
  amp: GainNode;
  /** The oscillators the capstan and the speed bend: they let go of them when the voice ends. */
  bent: OscillatorNode[];
  id: NoteTiming["id"];
  level: number;
  nodes: AudioNode[];
  sources: AudioScheduledSourceNode[];
  start: number;
  track: Track;
}

/** The key nearest a pitch in hertz, as a MIDI note. */
const keyOf = (frequency: number) =>
  Math.round(69 + 12 * Math.log2(frequency / 440));

/** Each key's strip is its own: a level and a tuning a little off, always the same for that key. */
function strip(key: number) {
  const seed = Math.sin(key * 12.9898) * 43_758.5453;
  const random = seed - Math.floor(seed);
  const other = Math.sin(key * 78.233) * 12_345.6789;
  return {
    cents: (random - 0.5) * 8,
    level: 10 ** (((other - Math.floor(other) - 0.5) * 3) / 20),
  };
}

function saturationCurve() {
  const curve = new Float32Array(1024);
  for (let index = 0; index < curve.length; index += 1) {
    const x = (index / (curve.length - 1)) * 2 - 1;
    curve[index] = Math.tanh(x * 1.3) / Math.tanh(1.3);
  }
  return curve;
}

const noises = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Two seconds of white noise, made once per context. */
function noiseOf(ctx: BaseAudioContext) {
  const kept = noises.get(ctx);
  if (kept) {
    return kept;
  }
  const buffer = ctx.createBuffer(
    1,
    ctx.sampleRate * NOISE_SECONDS,
    ctx.sampleRate
  );
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  noises.set(ctx, buffer);
  return buffer;
}

/** Where a key's level stands `elapsed` seconds into its tape: up its attack, then gone once the strip runs out. */
function levelAt(voice: Voice, elapsed: number) {
  const tau = ATTACK[voice.track] / 3;
  const end = TAPE_SECONDS - RUN_OUT.before;
  if (elapsed < end) {
    return voice.level * (1 - Math.exp(-elapsed / tau));
  }
  return (
    voice.level *
    (1 - Math.exp(-end / tau)) *
    Math.exp(-(elapsed - end) / RUN_OUT.tau)
  );
}

/**
 * One key of Tape Keys on the Web Audio API, for a `TapeKeysState`:
 *
 * ```
 * the track's players (flutes, strings or a choir) and the tape's hiss → amp ─┐
 *   (each key's strip a little off in pitch and level; vibrato)              │
 * saturation → high-pass → tone (low-pass) → output (volume) ←───────────────┘
 * the capstan's wow and flutter, and the speed, on every oscillator's pitch
 * ```
 *
 * A host plays chords with several of them, one note each. A key runs its
 * tape from the start on the track chosen, for eight seconds at most: after
 * that, the note stops however long the key stays down. Let go, the pads let
 * go of the tape at once. A pitch outside the 35 keys, G2 to F5, plays
 * nothing. The speed, the wow and the tone move a held key; the track takes
 * the next. A note while one is held cuts it and runs anew.
 */
export function createTapeKeysEngine(
  ctx: BaseAudioContext,
  initial: TapeKeysState
): TapeKeysEngine {
  let state = initial;
  let voice: Voice | null = null;

  const smooth = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, SMOOTHING);
  const when = (at?: number) => Math.max(ctx.currentTime, at ?? 0);

  const bus = ctx.createGain();
  const saturator = ctx.createWaveShaper();
  saturator.curve = saturationCurve();
  const high = ctx.createBiquadFilter();
  high.type = "highpass";
  high.frequency.value = 60;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = toneHertz(initial.tone);
  tone.Q.value = 0.4;
  const output = ctx.createGain();
  output.gain.value = volumeGain(initial.volume) * VOICE_GAIN;
  bus.connect(saturator).connect(high).connect(tone).connect(output);

  // The capstan: one slow wobble and one quick one, and the speed, on every oscillator's pitch.
  const wow = ctx.createOscillator();
  wow.frequency.value = WOW_HERTZ;
  const wowDepth = ctx.createGain();
  wowDepth.gain.value = (initial.wow / 10) * MAX_WOW_CENTS;
  wow.connect(wowDepth);
  const flutter = ctx.createOscillator();
  flutter.frequency.value = FLUTTER_HERTZ;
  const flutterDepth = ctx.createGain();
  flutterDepth.gain.value = (initial.wow / 10) * MAX_FLUTTER_CENTS;
  flutter.connect(flutterDepth);
  const speed = ctx.createConstantSource();
  speed.offset.value = speedCents(initial.speed);
  const capstan = [wow, flutter, speed];
  for (const source of capstan) {
    source.start();
  }

  const release = (held: Voice, time: number) => {
    held.amp.gain.cancelScheduledValues(time);
    held.amp.gain.setValueAtTime(levelAt(held, time - held.start), time);
    held.amp.gain.setTargetAtTime(0, time, RELEASE);
    // Never later than the end of the strip, where the tape already stops.
    const stop = Math.min(time + RELEASE * 8, held.start + TAPE_SECONDS + 0.05);
    for (const source of held.sources) {
      source.stop(stop);
    }
  };

  /** What a track's players put on tape for one key, into `into`: oscillators and noise, with their vibrato. */
  const record = (track: Track, key: number, into: AudioNode, time: number) => {
    const frequency = 440 * 2 ** ((key - 69) / 12);
    const { cents } = strip(key);
    const sources: AudioScheduledSourceNode[] = [];
    const nodes: AudioNode[] = [];
    const bent: OscillatorNode[] = [];

    const vibrato = VIBRATO[track];
    const lfo = ctx.createOscillator();
    lfo.frequency.value = vibrato.hertz * (0.95 + Math.random() * 0.1);
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, time);
    depth.gain.setTargetAtTime(vibrato.cents, time + vibrato.delay, 0.3);
    lfo.connect(depth);
    sources.push(lfo);
    nodes.push(depth);

    const oscillator = (
      type: OscillatorType,
      ratio: number,
      detune: number
    ) => {
      const made = ctx.createOscillator();
      made.type = type;
      made.frequency.setValueAtTime(frequency * ratio, time);
      made.detune.value = cents + detune;
      for (const bend of [speed, wowDepth, flutterDepth, depth]) {
        bend.connect(made.detune);
      }
      sources.push(made);
      bent.push(made);
      return made;
    };
    const breath = (level: number, center: number, q: number) => {
      const source = ctx.createBufferSource();
      source.buffer = noiseOf(ctx);
      source.loop = true;
      source.loopStart = Math.random();
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = center;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = level;
      source.connect(filter).connect(gain).connect(into);
      sources.push(source);
      nodes.push(filter, gain);
      return gain;
    };

    if (track === "flutes") {
      // A near sine and a little of its octave, and the breath across the mouthpiece, with a chiff as it speaks.
      const body = oscillator("sine", 1, 0);
      const octave = oscillator("triangle", 2, 2);
      const octaveLevel = ctx.createGain();
      octaveLevel.gain.value = 0.12;
      body.connect(into);
      octave.connect(octaveLevel).connect(into);
      const air = breath(0.05, Math.min(frequency * 3, 4000), 1.2);
      air.gain.setValueAtTime(0.22, time);
      air.gain.setTargetAtTime(0.05, time + 0.03, 0.04);
      nodes.push(octaveLevel);
    } else if (track === "strings") {
      // A section: three bows a little apart in tune, darkened as a body would.
      const body = ctx.createBiquadFilter();
      body.type = "lowpass";
      body.frequency.value = Math.min(7000, frequency * 7);
      body.Q.value = 0.5;
      for (const detune of [-9, 0, 7]) {
        oscillator("sawtooth", 1, detune).connect(body);
      }
      body.connect(into);
      nodes.push(body);
    } else {
      // A choir on "ah": two buzzes through the vowel's three formants, and some breath.
      const folds = ctx.createGain();
      oscillator("sawtooth", 1, -7).connect(folds);
      oscillator("sawtooth", 1, 6).connect(folds);
      for (const formant of AH) {
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = formant.hertz;
        filter.Q.value = formant.q;
        const gain = ctx.createGain();
        gain.gain.value = formant.gain;
        folds.connect(filter).connect(gain).connect(into);
        nodes.push(filter, gain);
      }
      breath(0.03, 2400, 0.8);
      nodes.push(folds);
    }

    // The tape's own hiss, for as long as it runs.
    breath(HISS_GAIN, 6000, 0.4);
    return { bent, nodes, sources };
  };

  const run = (key: number, id: Voice["id"], time: number): Voice => {
    const track = state.station;
    const level = TAPE_GAIN * TRACK_GAIN[track] * strip(key).level;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, time);
    amp.gain.setTargetAtTime(level, time, ATTACK[track] / 3);
    // The end of the strip: the recording stops there, key down or not.
    const end = time + TAPE_SECONDS;
    amp.gain.setTargetAtTime(0, end - RUN_OUT.before, RUN_OUT.tau);
    amp.connect(bus);
    const { bent, nodes, sources } = record(track, key, amp, time);
    const [first] = sources;
    if (first) {
      first.onended = () => {
        for (const node of [...sources, ...nodes, amp]) {
          node.disconnect();
        }
        for (const made of bent) {
          for (const bend of [speed, wowDepth, flutterDepth]) {
            bend.disconnect(made.detune);
          }
        }
      };
    }
    for (const source of sources) {
      source.start(time);
      source.stop(end + 0.05);
    }
    return { amp, bent, id, level, nodes, sources, start: time, track };
  };

  return {
    dispose: () => {
      for (const source of voice?.sources ?? []) {
        source.stop();
      }
      voice = null;
      for (const source of capstan) {
        source.stop();
      }
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
      const key = keyOf(note.frequency);
      const time = when(at);
      if (voice) {
        release(voice, time);
        voice = null;
      }
      if (key < TAPE_KEYS_LOWEST || key > TAPE_KEYS_HIGHEST) {
        return;
      }
      voice = run(key, id, time);
    },
    output,
    update: (next) => {
      state = next;
      smooth(output.gain, volumeGain(next.volume) * VOICE_GAIN);
      smooth(speed.offset, speedCents(next.speed));
      smooth(tone.frequency, toneHertz(next.tone));
      smooth(wowDepth.gain, (next.wow / 10) * MAX_WOW_CENTS);
      smooth(flutterDepth.gain, (next.wow / 10) * MAX_FLUTTER_CENTS);
    },
  };
}