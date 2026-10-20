/**
 * The samples Vesta-16 comes with: three kits of sixteen hits, made here with
 * oscillators and noise and rendered once into buffers, the way a sample is
 * decoded from a file. A kit changes the pitch, the length and the bite of the
 * same sixteen recipes; the lo-fi kit is then crushed to a coarse word length
 * and a held sample rate, as an old sampler stored it.
 */

import { PADS } from "./engine";

const RATE = 44_100;
const SECONDS = 1.3;
const CEILING = 0.9;

export type Kit = "808" | "Break" | "Lo-fi";
export const KITS: readonly Kit[] = ["808", "Break", "Lo-fi"];

/** What a pad is called on the panel, in the order of the grid: the first row is the lowest. */
export const SAMPLE_NAMES = [
  "Kick",
  "Kick 2",
  "Snare",
  "Rim",
  "Clap",
  "Hat C",
  "Hat O",
  "Crash",
  "Tom L",
  "Tom H",
  "Conga",
  "Cowbell",
  "Shaker",
  "Perc",
  "Zap",
  "Blip",
] as const;

interface Character {
  /** Bits kept and the share of samples held, when the kit is crushed. */
  crush?: { bits: number; hold: number };
  /** Multiplies every length. */
  length: number;
  /** Multiplies every pitch. */
  pitch: number;
}

const CHARACTERS: Record<Kit, Character> = {
  "808": { length: 1.25, pitch: 1 },
  Break: { length: 0.8, pitch: 1.15 },
  "Lo-fi": { crush: { bits: 6, hold: 4 }, length: 1, pitch: 0.9 },
};

type Out = AudioNode;

function tone(
  ctx: OfflineAudioContext,
  out: Out,
  {
    decay,
    from,
    level = 0.8,
    sweep = 0.04,
    to,
    type = "sine",
  }: {
    decay: number;
    from: number;
    level?: number;
    sweep?: number;
    to: number;
    type?: OscillatorType;
  }
) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, 0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), sweep);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, 0);
  gain.gain.exponentialRampToValueAtTime(0.0001, decay);
  osc.connect(gain).connect(out);
  osc.start(0);
  osc.stop(decay + 0.02);
}

function noise(
  ctx: OfflineAudioContext,
  out: Out,
  {
    at = 0,
    decay,
    frequency,
    level = 0.7,
    type = "highpass",
  }: {
    at?: number;
    decay: number;
    frequency: number;
    level?: number;
    type?: BiquadFilterType;
  }
) {
  const buffer = ctx.createBuffer(1, Math.ceil(RATE * (decay + 0.05)), RATE);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  source.connect(filter).connect(gain).connect(out);
  source.start(at);
}

/** Squares at inharmonic pitches through a band: a cowbell, a cymbal. */
function metal(
  ctx: OfflineAudioContext,
  out: Out,
  frequencies: readonly number[],
  { centre, decay, level }: { centre: number; decay: number; level: number }
) {
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = centre;
  band.Q.value = 1;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, 0);
  gain.gain.exponentialRampToValueAtTime(0.0001, decay);
  band.connect(gain).connect(out);
  for (const frequency of frequencies) {
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = frequency;
    osc.connect(band);
    osc.start(0);
    osc.stop(decay + 0.02);
  }
}

type Recipe = (ctx: OfflineAudioContext, out: Out, c: Character) => void;

const RECIPES: readonly Recipe[] = [
  (ctx, out, c) =>
    tone(ctx, out, {
      decay: 0.55 * c.length,
      from: 150 * c.pitch,
      to: 45 * c.pitch,
    }),
  (ctx, out, c) => {
    tone(ctx, out, {
      decay: 0.28 * c.length,
      from: 210 * c.pitch,
      level: 0.9,
      sweep: 0.03,
      to: 62 * c.pitch,
    });
    noise(ctx, out, { decay: 0.012, frequency: 2500, level: 0.4 });
  },
  (ctx, out, c) => {
    tone(ctx, out, {
      decay: 0.12 * c.length,
      from: 200 * c.pitch,
      level: 0.5,
      sweep: 0.02,
      to: 160 * c.pitch,
    });
    noise(ctx, out, { decay: 0.22 * c.length, frequency: 1500 });
  },
  (ctx, out, c) => {
    tone(ctx, out, {
      decay: 0.03,
      from: 1700 * c.pitch,
      level: 0.5,
      to: 1500 * c.pitch,
      type: "square",
    });
    tone(ctx, out, {
      decay: 0.05,
      from: 480 * c.pitch,
      level: 0.5,
      to: 400 * c.pitch,
    });
  },
  (ctx, out, c) => {
    for (const at of [0, 0.012, 0.024]) {
      noise(ctx, out, {
        at,
        decay: 0.014,
        frequency: 1100,
        level: 0.6,
        type: "bandpass",
      });
    }
    noise(ctx, out, {
      at: 0.036,
      decay: 0.2 * c.length,
      frequency: 1100,
      level: 0.55,
      type: "bandpass",
    });
  },
  (ctx, out, c) =>
    noise(ctx, out, { decay: 0.05 * c.length, frequency: 7500, level: 0.5 }),
  (ctx, out, c) =>
    noise(ctx, out, { decay: 0.45 * c.length, frequency: 7000, level: 0.5 }),
  (ctx, out, c) => {
    noise(ctx, out, { decay: 1.1 * c.length, frequency: 3500, level: 0.45 });
    metal(
      ctx,
      out,
      [205, 304, 370, 523, 540, 800].map((f) => f * c.pitch),
      { centre: 6000, decay: 0.9 * c.length, level: 0.25 }
    );
  },
  (ctx, out, c) =>
    tone(ctx, out, {
      decay: 0.38 * c.length,
      from: 130 * c.pitch,
      to: 80 * c.pitch,
    }),
  (ctx, out, c) =>
    tone(ctx, out, {
      decay: 0.28 * c.length,
      from: 230 * c.pitch,
      to: 150 * c.pitch,
    }),
  (ctx, out, c) =>
    tone(ctx, out, {
      decay: 0.22 * c.length,
      from: 340 * c.pitch,
      level: 0.7,
      to: 290 * c.pitch,
      type: "triangle",
    }),
  (ctx, out, c) =>
    metal(ctx, out, [560 * c.pitch, 845 * c.pitch], {
      centre: 2640,
      decay: 0.3 * c.length,
      level: 0.7,
    }),
  (ctx, out) => {
    const buffer = ctx.createBuffer(1, Math.ceil(RATE * 0.2), RATE);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      const t = i / data.length;
      data[i] =
        (Math.random() * 2 - 1) *
        Math.sin(Math.PI * Math.min(1, t * 1.6)) ** 2 *
        (1 - t);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 5500;
    const gain = ctx.createGain();
    gain.gain.value = 0.6;
    source.connect(filter).connect(gain).connect(out);
    source.start(0);
  },
  (ctx, out, c) =>
    tone(ctx, out, {
      decay: 0.16 * c.length,
      from: 900 * c.pitch,
      level: 0.6,
      to: 700 * c.pitch,
      type: "triangle",
    }),
  (ctx, out, c) =>
    tone(ctx, out, {
      decay: 0.32 * c.length,
      from: 2200 * c.pitch,
      level: 0.5,
      sweep: 0.25,
      to: 90 * c.pitch,
      type: "sawtooth",
    }),
  (ctx, out, c) => {
    tone(ctx, out, {
      decay: 0.07,
      from: 660 * c.pitch,
      level: 0.5,
      to: 650 * c.pitch,
      type: "square",
    });
    tone(ctx, out, {
      decay: 0.14,
      from: 990 * c.pitch,
      level: 0.45,
      to: 980 * c.pitch,
      type: "square",
    });
  },
];

/** The coarse word length and held sample rate of an old sampler. */
function crush(
  data: Float32Array,
  { bits, hold }: { bits: number; hold: number }
) {
  const steps = 2 ** (bits - 1);
  let held = 0;
  for (let i = 0; i < data.length; i += 1) {
    if (i % hold === 0) {
      held = Math.round((data[i] ?? 0) * steps) / steps;
    }
    data[i] = held;
  }
}

/** Brings a buffer to the shared peak, and trims the silence after its end. */
function finish(buffer: AudioBuffer) {
  const data = buffer.getChannelData(0);
  let peak = 0;
  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    const level = Math.abs(data[i] ?? 0);
    peak = Math.max(peak, level);
    if (level > 0.002) {
      last = i;
    }
  }
  const length = Math.min(data.length, last + Math.ceil(RATE * 0.02));
  const trimmed = new AudioBuffer({
    length: Math.max(1, length),
    numberOfChannels: 1,
    sampleRate: RATE,
  });
  const gain = peak > 0 ? CEILING / peak : 1;
  const target = trimmed.getChannelData(0);
  for (let i = 0; i < target.length; i += 1) {
    target[i] = (data[i] ?? 0) * gain;
  }
  return trimmed;
}

/** Renders a kit: sixteen buffers, as sixteen decoded files would arrive. */
export async function renderKit(kit: Kit): Promise<AudioBuffer[]> {
  const character = CHARACTERS[kit];
  return await Promise.all(
    RECIPES.slice(0, PADS).map(async (recipe) => {
      const ctx = new OfflineAudioContext(1, Math.ceil(RATE * SECONDS), RATE);
      const out = ctx.createGain();
      out.connect(ctx.destination);
      recipe(ctx, out, character);
      const rendered = await ctx.startRendering();
      if (character.crush) {
        crush(rendered.getChannelData(0), character.crush);
      }
      return finish(rendered);
    })
  );
}
