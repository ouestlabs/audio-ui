/**
 * The six loops Rigel-6 mixes: a kick, a snare, hats, a bass, keys and a lead,
 * made here with oscillators and noise, two bars at 100 BPM. Each is rendered
 * once into its own buffer, as a stem would arrive, and brought to the same
 * peak so the faders start from the same place.
 */

import type { Channel } from "./engine";

const RATE = 44_100;
const BPM = 100;
const BEAT = 60 / BPM;
const BEATS = 8;
const PEAK = 0.5;
const hertz = (note: number) => 440 * 2 ** ((note - 69) / 12);

type Render = (ctx: OfflineAudioContext, out: AudioNode) => void;

/** A small room's impulse response: noise that fades over a second and darkens as it goes. */
function hall(ctx: OfflineAudioContext) {
  const seconds = 1.4;
  const length = Math.ceil(RATE * seconds);
  const buffer = ctx.createBuffer(2, length, RATE);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let low = 0;
    for (let i = 0; i < length; i += 1) {
      const time = i / RATE;
      // The air takes the high end first: a one-pole low-pass that closes with time.
      const coefficient = 0.9 - 0.8 * Math.exp(-time / 0.5);
      low += (Math.random() * 2 - 1 - low) * (1 - coefficient);
      data[i] = low * Math.exp(-time / 0.3) * Math.min(1, time / 0.03);
    }
  }
  return buffer;
}

/** A sine with a falling envelope. */
function partial(
  ctx: OfflineAudioContext,
  out: AudioNode,
  {
    at,
    decay,
    frequency,
    level,
    type = "sine",
  }: {
    at: number;
    decay: number;
    frequency: number;
    level: number;
    type?: OscillatorType;
  }
) {
  const osc = ctx.createOscillator();
  osc.type = type;
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
    frequency,
    level,
    type,
  }: {
    at: number;
    decay: number;
    frequency: number;
    level: number;
    type: BiquadFilterType;
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
  biquad.type = type;
  biquad.frequency.value = frequency;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  source.connect(biquad).connect(gain).connect(out);
  source.start(at);
}

const CHORDS = [
  { at: 0, notes: [57, 60, 64, 67] },
  { at: 2, notes: [53, 57, 60, 64] },
  { at: 4, notes: [50, 53, 57, 60] },
  { at: 6, notes: [52, 56, 59, 62] },
];
const BASS = [33, 33, 36, 33, 40, 38, 36, 31];
const LEAD = [69, 72, 76, 79, 81, 79, 76, 72];
/** How many loops a stem is rendered over: a reverb tail needs a pass before the one kept. */
const PASSES: Partial<Record<Channel, number>> = { lead: 2 };

const RENDERS: Record<Channel, Render> = {
  bass(ctx, out) {
    for (const [beat, note] of BASS.entries()) {
      const at = beat * BEAT;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, at);
      filter.frequency.exponentialRampToValueAtTime(150, at + 0.4);
      filter.connect(out);
      const saw = ctx.createOscillator();
      saw.type = "sawtooth";
      saw.frequency.value = hertz(note);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.7, at + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + BEAT * 0.95);
      saw.connect(gain).connect(filter);
      saw.start(at);
      saw.stop(at + BEAT);
    }
  },
  hats(ctx, out) {
    for (let eighth = 0; eighth < BEATS * 2; eighth += 1) {
      noise(ctx, out, {
        at: eighth * 0.5 * BEAT,
        decay: 0.04,
        frequency: 8000,
        level: eighth % 2 ? 0.1 : 0.2,
        type: "highpass",
      });
    }
    for (const beat of [3.5, 7.5]) {
      noise(ctx, out, {
        at: beat * BEAT,
        decay: 0.25,
        frequency: 7000,
        level: 0.16,
        type: "highpass",
      });
    }
  },
  keys(ctx, out) {
    for (const chord of CHORDS) {
      for (const [stab, level] of [
        [0, 1],
        [1.5, 0.45],
      ] as const) {
        for (const [index, note] of chord.notes.entries()) {
          const at = (chord.at + stab) * BEAT + index * 0.014;
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
  },
  kick(ctx, out) {
    for (let beat = 0; beat < BEATS; beat += 1) {
      const at = beat * BEAT;
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(140, at);
      osc.frequency.exponentialRampToValueAtTime(48, at + 0.05);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.9, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
      osc.connect(gain).connect(out);
      osc.start(at);
      osc.stop(at + 0.35);
    }
  },
  lead(ctx, out) {
    // The arpeggio, on a soft spacey voice: two detuned triangles and a sine an
    // octave up, a slow vibrato, and a short, quiet room. It plays the loop
    // twice, so the end of the room's tail lands at the start of the second.
    const dry = ctx.createGain();
    dry.gain.value = 0.85;
    dry.connect(out);
    const room = ctx.createConvolver();
    room.buffer = hall(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    room.connect(wet).connect(out);
    const send = ctx.createGain();
    send.connect(dry);
    send.connect(room);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 4.5;
    lfo.start(0);
    for (const pass of [0, 1]) {
      for (let step = 0; step < BEATS * 2; step += 1) {
        const note = LEAD[step % LEAD.length] ?? 69;
        const at = (pass * BEATS + step * 0.5) * BEAT;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.3, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.55);
        gain.connect(send);
        for (const [detune, ratio, level] of [
          [-6, 1, 1],
          [6, 1, 1],
          [0, 2, 0.3],
        ] as const) {
          const osc = ctx.createOscillator();
          osc.type = ratio === 1 ? "triangle" : "sine";
          osc.frequency.value = hertz(note) * ratio;
          osc.detune.value = detune;
          const vibrato = ctx.createGain();
          vibrato.gain.value = 6;
          lfo.connect(vibrato).connect(osc.detune);
          const share = ctx.createGain();
          share.gain.value = level;
          osc.connect(share).connect(gain);
          osc.start(at);
          osc.stop(at + 0.6);
        }
      }
    }
  },
  snare(ctx, out) {
    for (const beat of [1, 3, 5, 7]) {
      const at = beat * BEAT;
      noise(ctx, out, {
        at,
        decay: 0.18,
        frequency: 1800,
        level: 0.6,
        type: "highpass",
      });
      partial(ctx, out, { at, decay: 0.09, frequency: 190, level: 0.4 });
    }
  },
};

/** Brings a buffer to the stems' shared peak. */
function normalize(buffer: AudioBuffer) {
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    for (const sample of buffer.getChannelData(channel)) {
      peak = Math.max(peak, Math.abs(sample));
    }
  }
  if (peak === 0) {
    return buffer;
  }
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (data[i] ?? 0) * (PEAK / peak);
    }
  }
  return buffer;
}

/** Renders one stem, as a decoded file would arrive. */
export async function renderStem(channel: Channel) {
  const passes = PASSES[channel] ?? 1;
  const loop = Math.ceil(RATE * BEAT * BEATS);
  const ctx = new OfflineAudioContext(2, loop * passes, RATE);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  RENDERS[channel](ctx, out);
  const rendered = await ctx.startRendering();
  if (passes === 1) {
    return normalize(rendered);
  }
  // Keeps the last loop only: it carries the tail of the one before it.
  const kept = new AudioBuffer({
    length: loop,
    numberOfChannels: rendered.numberOfChannels,
    sampleRate: RATE,
  });
  for (
    let channelIndex = 0;
    channelIndex < kept.numberOfChannels;
    channelIndex += 1
  ) {
    kept.copyToChannel(
      rendered.getChannelData(channelIndex).subarray(loop * (passes - 1)),
      channelIndex
    );
  }
  return normalize(kept);
}
