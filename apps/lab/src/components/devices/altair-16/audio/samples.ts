/**
 * The samples Altair-16 comes with: short loops made here, with oscillators
 * and noise, rendered once into a buffer the way a file would be decoded. A
 * sample is two bars cut into sixteen equal slices, so each pad lands on an
 * eighth note of the loop.
 */

export interface Sample {
  bpm: number;
  name: string;
  /** Plays the loop's notes into `ctx`; the loop is `beats` long. */
  render: (ctx: OfflineAudioContext, beat: number) => void;
}

const RATE = 44_100;
const BEATS = 8;
const hertz = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** A sine with a falling envelope: one partial of a key. */
function partial(
  ctx: OfflineAudioContext,
  out: AudioNode,
  {
    at,
    decay,
    frequency,
    level,
  }: { at: number; decay: number; frequency: number; level: number }
) {
  const osc = ctx.createOscillator();
  osc.frequency.value = frequency;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(level, at + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + decay + 0.02);
}

function noise(
  ctx: OfflineAudioContext,
  out: AudioNode,
  {
    at,
    decay,
    filter,
    level,
  }: {
    at: number;
    decay: number;
    filter: { frequency: number; type: BiquadFilterType };
    level: number;
  }
) {
  const buffer = ctx.createBuffer(1, Math.ceil(RATE * (decay + 0.02)), RATE);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const biquad = ctx.createBiquadFilter();
  biquad.type = filter.type;
  biquad.frequency.value = filter.frequency;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  source.connect(biquad).connect(gain).connect(out);
  source.start(at);
}

const CHORDS: { at: number; notes: number[] }[] = [
  { at: 0, notes: [57, 60, 64, 67] },
  { at: 2, notes: [53, 57, 60, 64] },
  { at: 4, notes: [50, 53, 57, 60] },
  { at: 6, notes: [52, 56, 59, 62] },
];

export const SAMPLES: readonly Sample[] = [
  {
    bpm: 88,
    name: "Dusty keys",
    render(ctx, beat) {
      const out = ctx.createGain();
      out.gain.value = 0.5;
      out.connect(ctx.destination);
      // Electric piano chords, twice a chord: the full stab and a soft one after it.
      for (const chord of CHORDS) {
        for (const [stab, level] of [
          [0, 1],
          [1.5, 0.45],
        ] as const) {
          for (const [index, note] of chord.notes.entries()) {
            const at = (chord.at + stab) * beat + index * 0.014;
            const base = hertz(note);
            partial(ctx, out, {
              at,
              decay: 1.1 * level + 0.3,
              frequency: base,
              level: 0.16 * level,
            });
            partial(ctx, out, {
              at,
              decay: 0.35,
              frequency: base * 2,
              level: 0.06 * level,
            });
            partial(ctx, out, {
              at,
              decay: 0.12,
              frequency: base * 4.01,
              level: 0.03 * level,
            });
          }
        }
      }
      // A kick on the one and the and-of-two, a snare on two and four, hats on the eighths.
      for (const at of [0, 2.5, 4, 6.5]) {
        const kick = ctx.createOscillator();
        kick.frequency.setValueAtTime(140, at * beat);
        kick.frequency.exponentialRampToValueAtTime(48, at * beat + 0.05);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.9, at * beat);
        gain.gain.exponentialRampToValueAtTime(0.0001, at * beat + 0.3);
        kick.connect(gain).connect(out);
        kick.start(at * beat);
        kick.stop(at * beat + 0.35);
      }
      for (const at of [1, 3, 5, 7]) {
        noise(ctx, out, {
          at: at * beat,
          decay: 0.16,
          filter: { frequency: 1800, type: "highpass" },
          level: 0.5,
        });
        partial(ctx, out, {
          at: at * beat,
          decay: 0.08,
          frequency: 190,
          level: 0.4,
        });
      }
      for (let eighth = 0; eighth < BEATS * 2; eighth += 1) {
        noise(ctx, out, {
          at: eighth * 0.5 * beat,
          decay: 0.04,
          filter: { frequency: 8000, type: "highpass" },
          level: eighth % 2 ? 0.1 : 0.18,
        });
      }
      // The dust of an old record under all of it.
      noise(ctx, out, {
        at: 0,
        decay: BEATS * beat,
        filter: { frequency: 5000, type: "highpass" },
        level: 0.008,
      });
    },
  },
  {
    bpm: 96,
    name: "Sub line",
    render(ctx, beat) {
      const out = ctx.createGain();
      out.gain.value = 0.6;
      out.connect(ctx.destination);
      // Sixteen eighth notes of a bass line: every slice is a different note.
      const line = [
        33, 33, 36, 33, 40, 38, 36, 33, 31, 31, 35, 31, 38, 36, 35, 31,
      ];
      for (const [index, note] of line.entries()) {
        const at = index * 0.5 * beat;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(900, at);
        filter.frequency.exponentialRampToValueAtTime(160, at + 0.22);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.8, at + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.27);
        filter.connect(gain).connect(out);
        const saw = ctx.createOscillator();
        saw.type = "sawtooth";
        saw.frequency.value = hertz(note);
        saw.connect(filter);
        saw.start(at);
        saw.stop(at + 0.3);
        partial(ctx, out, {
          at,
          decay: 0.27,
          frequency: hertz(note),
          level: 0.5,
        });
      }
    },
  },
];

/** Renders a built-in sample into a buffer, as a decoded file would arrive. */
export async function renderSample(sample: Sample) {
  const beat = 60 / sample.bpm;
  const ctx = new OfflineAudioContext(2, Math.ceil(RATE * beat * BEATS), RATE);
  sample.render(ctx, beat);
  return await ctx.startRendering();
}
