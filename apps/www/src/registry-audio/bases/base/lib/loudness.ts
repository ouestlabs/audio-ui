/**
 * How loud a sound is, the way streaming services and broadcasters measure
 * it (ITU-R BS.1770): its integrated loudness in LUFS and its true peak in
 * dBTP, through `@audio/loudness-lufs` and `@audio/loudness-truepeak`, and the
 * gain that brings it to a target without passing a ceiling. And while it
 * plays: its momentary, short-term and integrated loudness, measured on the
 * audio thread through the K-weighting of `@audio/weighting-k`.
 */

import lufs from "@audio/loudness-lufs";
import truepeak from "@audio/loudness-truepeak";
import kWeighting from "@audio/weighting-k";
import { peakDb } from "@audio-ui/core/analysis";

/** Targets in LUFS: what streaming services, podcasts and broadcast (EBU R 128) ask a file to be. */
export const LOUDNESS_TARGETS = {
  broadcast: -23,
  podcast: -16,
  streaming: -14,
} as const;

/** How loud a sound is. Each is `-Infinity` for silence. */
export interface Loudness {
  /** Integrated loudness, in LUFS: over the whole sound, its quiet passages gated out. */
  lufs: number;
  /** The loudest sample, in dBFS. */
  peak: number;
  /** The loudest point of the waveform between the samples too, in dBTP: what a converter may play past full scale. */
  truePeak: number;
}

/**
 * Measures whole channels at once. It reads every sample, the true peak at
 * four points a sample: about half a second a minute of loud stereo on a
 * laptop, so call it where the page can wait, as an export does.
 */
export function measureLoudness(
  channels: readonly Float32Array[],
  sampleRate: number
): Loudness {
  if (channels.length === 0) {
    return {
      lufs: Number.NEGATIVE_INFINITY,
      peak: Number.NEGATIVE_INFINITY,
      truePeak: Number.NEGATIVE_INFINITY,
    };
  }
  return {
    lufs: lufs([...channels], { fs: sampleRate }) ?? Number.NEGATIVE_INFINITY,
    peak: Math.max(...channels.map((channel) => peakDb(channel))),
    truePeak: truepeak([...channels], { fs: sampleRate }),
  };
}

/**
 * The gain in dB that brings a sound to `target` LUFS, as far as its true
 * peak stays at or under `ceiling` dBTP: a sound that would pass it lands
 * under the target instead, and nothing is limited. 0 for silence.
 */
export function loudnessGain(
  loudness: Loudness,
  target: number,
  ceiling = -1
): number {
  if (!Number.isFinite(loudness.lufs)) {
    return 0;
  }
  return Math.min(target - loudness.lufs, ceiling - loudness.truePeak);
}

/** What BS.1770 adds to a K-weighted mean square to read it in LUFS. */
const OFFSET = -0.691;
/** The power of a 400 ms window at the absolute gate, -70 LUFS: anything quieter is silence. */
const ABSOLUTE_GATE = 10 ** ((-70 - OFFSET) / 10);
/** The relative gate, 10 LU under the loudness of what passed the absolute one, as a ratio of power. */
const RELATIVE_GATE = 10 ** (-10 / 10);
/** A window is 4 blocks of 100 ms: what momentary loudness reads, and what the gates count. */
const WINDOW_BLOCKS = 4;
/** Short-term loudness reads the last 3 s. */
const SHORT_TERM_BLOCKS = 30;

const lufsOf = (power: number) => OFFSET + 10 * Math.log10(power);
const mean = (powers: readonly number[]) =>
  powers.reduce((sum, power) => sum + power, 0) / powers.length;

/** How loud a sound is while it plays, in LUFS. Each is `-Infinity` until there is enough of the sound to read it, and for silence. */
export interface LiveLoudness {
  /** Over everything since the reader was cleared, its quiet passages gated out: what a target such as -14 LUFS is measured against. */
  integrated: number;
  /** Over the last 400 ms. */
  momentary: number;
  /** Over the last 3 s. */
  shortTerm: number;
}

/**
 * Reads loudness block by block: `add` takes the K-weighted mean square of
 * the next 100 ms, summed over the channels, as the meter's processor posts
 * it, and gives the loudness up to it. The integrated loudness counts every
 * 400 ms window that passes the gates of BS.1770 (-70 LUFS, then 10 LU under
 * the loudness of the rest): it agrees with `measureLoudness` on a whole
 * sound. `clear` starts it over; the momentary and short-term loudness go on.
 */
export function createLoudnessReader() {
  const recent: number[] = [];
  let windows: number[] = [];
  let since = 0;
  return {
    add: (block: number): LiveLoudness => {
      recent.push(block);
      if (recent.length > SHORT_TERM_BLOCKS) {
        recent.shift();
      }
      since += 1;
      const window =
        recent.length >= WINDOW_BLOCKS ? mean(recent.slice(-WINDOW_BLOCKS)) : 0;
      // A window counts once it is made of blocks since the last clear.
      if (since >= WINDOW_BLOCKS && window > ABSOLUTE_GATE) {
        windows.push(window);
      }
      const gate = windows.length > 0 ? mean(windows) * RELATIVE_GATE : 0;
      const loud = windows.filter((power) => power > gate);
      return {
        integrated:
          loud.length > 0 ? lufsOf(mean(loud)) : Number.NEGATIVE_INFINITY,
        momentary: lufsOf(window),
        shortTerm:
          recent.length === SHORT_TERM_BLOCKS
            ? lufsOf(mean(recent))
            : Number.NEGATIVE_INFINITY,
      };
    },
    clear: () => {
      windows = [];
      since = 0;
    },
  };
}

const PROCESSOR = "audioui-loudness";

/**
 * The meter's processor: it K-weights each channel of its input (a high
 * shelf, then a high-pass, with the coefficients `@audio/weighting-k` gives
 * for the context's rate), and posts the mean square of each block of 100 ms,
 * summed over the channels. A quantum with no input counts as silence. It has
 * no output, so what it measures is never heard through it.
 */
export const LOUDNESS_WORKLET = `class LoudnessMeter extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const { coefs, frames } = options.processorOptions;
    this.shelf = coefs[0];
    this.highpass = coefs[1];
    this.frames = frames;
    this.states = [];
    this.sum = 0;
    this.count = 0;
  }
  filter(state, x) {
    const s = this.shelf;
    const h = this.highpass;
    const u = s.b0 * x + state[0];
    state[0] = s.b1 * x - s.a1 * u + state[1];
    state[1] = s.b2 * x - s.a2 * u;
    const y = h.b0 * u + state[2];
    state[2] = h.b1 * u - h.a1 * y + state[3];
    state[3] = h.b2 * u - h.a2 * y;
    return y;
  }
  process(inputs) {
    const input = inputs[0] || [];
    const length = input.length > 0 ? input[0].length : 128;
    while (this.states.length < input.length) {
      this.states.push(new Float64Array(4));
    }
    for (let i = 0; i < length; i++) {
      for (let c = 0; c < input.length; c++) {
        const y = this.filter(this.states[c], input[c][i]);
        this.sum += y * y;
      }
      this.count++;
      if (this.count === this.frames) {
        this.port.postMessage(this.sum / this.frames);
        this.sum = 0;
        this.count = 0;
        // A filter left ringing into silence would reach the subnormal numbers, which are slow.
        for (const state of this.states) {
          for (let k = 0; k < 4; k++) {
            if (Math.abs(state[k]) < 1e-30) state[k] = 0;
          }
        }
      }
    }
    return true;
  }
}
registerProcessor("${PROCESSOR}", LoudnessMeter);`;

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

function loadMeter(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  // A page without a secure origin has no worklets.
  if (!("audioWorklet" in ctx && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([LOUDNESS_WORKLET], { type: "text/javascript" })
  );
  const done = ctx.audioWorklet
    .addModule(url)
    .then(() => true)
    .catch(() => false)
    .finally(() => URL.revokeObjectURL(url));
  loaded.set(ctx, done);
  return done;
}

/** A live loudness meter on a context, as `createLoudnessMeter` makes it. */
export interface LoudnessMeter {
  /** Starts the integrated loudness over, from the next block. */
  clear: () => void;
  dispose: () => void;
  /** Connect what to measure here, in stereo: a mono input is in both channels. It is only listened to, never heard. */
  readonly input: AudioNode;
}

/**
 * Measures what is connected to it while it plays, on the audio thread, and
 * calls `onLoudness` with its momentary, short-term and integrated loudness
 * every 100 ms. `null` when the context cannot run worklets.
 */
export async function createLoudnessMeter(
  ctx: BaseAudioContext,
  onLoudness: (loudness: LiveLoudness) => void
): Promise<LoudnessMeter | null> {
  if (!(await loadMeter(ctx))) {
    return null;
  }
  const node = new AudioWorkletNode(ctx, PROCESSOR, {
    channelCount: 2,
    channelCountMode: "explicit",
    channelInterpretation: "speakers",
    numberOfInputs: 1,
    numberOfOutputs: 0,
    processorOptions: {
      coefs: kWeighting.coefs(ctx.sampleRate),
      frames: Math.round(ctx.sampleRate / 10),
    },
  });
  const reader = createLoudnessReader();
  node.port.onmessage = (event: MessageEvent<number>) =>
    onLoudness(reader.add(event.data));
  return {
    clear: reader.clear,
    dispose: () => {
      node.port.onmessage = null;
      node.port.close();
    },
    input: node,
  };
}
