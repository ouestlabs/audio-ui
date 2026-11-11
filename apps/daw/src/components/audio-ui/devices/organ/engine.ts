import type { InstrumentBinding, NoteTiming } from "@audio-ui/engine/device";
import {
  clickGain,
  drawbarGain,
  driveGain,
  ORGAN_DRAWBARS,
  type OrganNote,
  type OrganState,
  volumeGain,
} from "@/components/audio-ui/devices/organ/device";

/** Headroom: nine partials a key stay under full scale. */
const PARTIAL_GAIN = 0.1;
/** What a key is lifted by on its way out, +12 dB: a key plays alone, where a whole organ summed a chord. */
const VOICE_GAIN = 4;
const ATTACK = 0.004;
const RELEASE = 0.025;
/** How fast a control moves a parameter: slow enough for a drag to make no click. */
const SMOOTHING = 0.02;
/** The softest key still sounds: a velocity of 0 is this share of a full one. */
const MIN_LEVEL = 0.4;
const PERCUSSION_LEVEL = 0.6;
const PERCUSSION_SECONDS = { fast: 0.22, slow: 0.5 } as const;
const CLICK_SECONDS = 0.05;
/** What each speed of the rotary speaker does: how fast it turns, how far it sways the pitch and the level. */
const ROTARY = {
  fast: { rate: 6.6, sway: 0.000_32, tremolo: 0.28 },
  slow: { rate: 0.85, sway: 0.0005, tremolo: 0.2 },
  stop: { rate: 0.3, sway: 0, tremolo: 0 },
} as const;
/** The horns take a moment to reach a new speed. */
const SPEED_TIME = 0.7;

export interface OrganEngine extends InstrumentBinding<OrganState, OrganNote> {
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
}

interface Voice {
  amp: GainNode;
  id: NoteTiming["id"];
  level: number;
  levels: GainNode[];
  oscillators: OscillatorNode[];
  start: number;
}

/**
 * A registration with few drawbars out would sound far under one with all of
 * them: the trim lifts it part of the way, by the energy of the bars, so
 * changing a registration does not mean reaching for the volume.
 */
export function registrationTrim(state: OrganState) {
  const energy = ORGAN_DRAWBARS.reduce(
    (sum, bar) => sum + drawbarGain(state[bar.id]) ** 2,
    0
  );
  return energy > 0 ? Math.min(6, energy ** -0.7) : 1;
}

function saturationCurve() {
  const curve = new Float32Array(1024);
  for (let index = 0; index < curve.length; index += 1) {
    const x = (index / (curve.length - 1)) * 2 - 1;
    curve[index] = Math.tanh(x * 2) / 2;
  }
  return curve;
}

const clicks = new WeakMap<BaseAudioContext, AudioBuffer>();

/** The key click's tick: a few milliseconds of noise that dies away, made once per context. */
function clickOf(ctx: BaseAudioContext) {
  const kept = clicks.get(ctx);
  if (kept) {
    return kept;
  }
  const buffer = ctx.createBuffer(
    1,
    Math.ceil(ctx.sampleRate * CLICK_SECONDS),
    ctx.sampleRate
  );
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / data.length) ** 3;
  }
  clicks.set(ctx, buffer);
  return buffer;
}

/**
 * One key of the Organ on the Web Audio API, for an `OrganState`:
 *
 * ```
 * nine sines at the drawbars' harmonics ─┐
 * percussion (2nd or 3rd harmonic)  ─────┼→ amp → trim → drive → rotary speaker → output (volume)
 * key click ─────────────────────────────┘         (registration)  (sway and tremolo, a side each)
 * ```
 *
 * A host plays chords with several of them, one note each. A key sounds at
 * once and stops at once, as an organ's does, the percussion and the click
 * opening it; a drawbar moved sounds on a held key. The rotary speaker takes
 * a moment to reach a new speed, as its horns do. A note while one is held
 * cuts it and sounds anew.
 */
export function createOrganEngine(
  ctx: BaseAudioContext,
  initial: OrganState
): OrganEngine {
  let state = initial;
  let voice: Voice | null = null;

  const smooth = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, SMOOTHING);
  const when = (at?: number) => Math.max(ctx.currentTime, at ?? 0);
  const partial = (index: number) => {
    const bar = ORGAN_DRAWBARS[index];
    return bar ? drawbarGain(state[bar.id]) * PARTIAL_GAIN : 0;
  };

  const bus = ctx.createGain();
  const trim = ctx.createGain();
  trim.gain.value = registrationTrim(initial);
  const drive = ctx.createGain();
  drive.gain.value = driveGain(initial.drive);
  const shaper = ctx.createWaveShaper();
  shaper.curve = saturationCurve();
  const makeup = ctx.createGain();
  makeup.gain.value = 0.7;
  bus.connect(trim).connect(drive).connect(shaper).connect(makeup);

  // The rotary speaker: two delays swayed opposite ways and two tremolos, one a side.
  const output = ctx.createGain();
  output.gain.value = volumeGain(initial.volume) * VOICE_GAIN;
  const left = ctx.createDelay(0.05);
  const right = ctx.createDelay(0.05);
  left.delayTime.value = 0.004;
  right.delayTime.value = 0.004;
  const sideLeft = ctx.createGain();
  const sideRight = ctx.createGain();
  sideLeft.gain.value = 0.8;
  sideRight.gain.value = 0.8;
  const merger = ctx.createChannelMerger(2);
  makeup.connect(left).connect(sideLeft).connect(merger, 0, 0);
  makeup.connect(right).connect(sideRight).connect(merger, 0, 1);
  merger.connect(output);
  // The speaker starts at the speed of its switch: only a later change takes its time to arrive.
  const speed = ROTARY[initial.rotary];
  const lfo = ctx.createOscillator();
  lfo.frequency.value = speed.rate;
  const swayLeft = ctx.createGain();
  const swayRight = ctx.createGain();
  const tremoloLeft = ctx.createGain();
  const tremoloRight = ctx.createGain();
  swayLeft.gain.value = speed.sway;
  swayRight.gain.value = -speed.sway;
  tremoloLeft.gain.value = speed.tremolo;
  tremoloRight.gain.value = -speed.tremolo;
  lfo.connect(swayLeft).connect(left.delayTime);
  lfo.connect(swayRight).connect(right.delayTime);
  lfo.connect(tremoloLeft).connect(sideLeft.gain);
  lfo.connect(tremoloRight).connect(sideRight.gain);
  lfo.start();

  const release = (held: Voice, time: number) => {
    const elapsed = time - held.start;
    const reached =
      elapsed < ATTACK ? held.level * (elapsed / ATTACK) : held.level;
    held.amp.gain.cancelScheduledValues(time);
    held.amp.gain.setValueAtTime(reached, time);
    held.amp.gain.setTargetAtTime(0, time, RELEASE / 3);
    for (const oscillator of held.oscillators) {
      oscillator.stop(time + RELEASE * 4);
    }
  };

  /** The percussion: a decaying sine on the second or third harmonic, on the note's attack only. */
  const percussion = (amp: AudioNode, frequency: number, time: number) => {
    const oscillator = ctx.createOscillator();
    oscillator.frequency.setValueAtTime(
      frequency * (state.harmonic === "second" ? 2 : 3),
      time
    );
    const decay = PERCUSSION_SECONDS[state.decay];
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(PERCUSSION_LEVEL * PARTIAL_GAIN * 4, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    oscillator.connect(gain).connect(amp);
    oscillator.onended = () => gain.disconnect();
    oscillator.start(time);
    oscillator.stop(time + decay + 0.05);
  };

  /** The key click: a few milliseconds of high noise as the contacts close. */
  const keyClick = (amp: AudioNode, time: number) => {
    const source = ctx.createBufferSource();
    source.buffer = clickOf(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 2500;
    const gain = ctx.createGain();
    gain.gain.value = clickGain(state.click);
    source.connect(filter).connect(gain).connect(amp);
    source.onended = () => gain.disconnect();
    source.start(time);
  };

  const strike = (note: OrganNote, id: Voice["id"], time: number): Voice => {
    const velocity = Math.min(1, Math.max(0, note.velocity ?? 1));
    const level = MIN_LEVEL + (1 - MIN_LEVEL) * velocity;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(level, time + ATTACK);
    amp.connect(bus);
    const oscillators: OscillatorNode[] = [];
    const levels: GainNode[] = [];
    for (const [index, bar] of ORGAN_DRAWBARS.entries()) {
      const oscillator = ctx.createOscillator();
      oscillator.frequency.setValueAtTime(note.frequency * bar.ratio, time);
      const gain = ctx.createGain();
      gain.gain.value = partial(index);
      oscillator.connect(gain).connect(amp);
      oscillators.push(oscillator);
      levels.push(gain);
    }
    if (state.percussion) {
      percussion(amp, note.frequency, time);
    }
    if (state.click > 0) {
      keyClick(amp, time);
    }
    const [first] = oscillators;
    if (first) {
      first.onended = () => {
        for (const node of [...oscillators, ...levels, amp]) {
          node.disconnect();
        }
      };
    }
    for (const oscillator of oscillators) {
      oscillator.start(time);
    }
    return { amp, id, level, levels, oscillators, start: time };
  };

  return {
    dispose: () => {
      for (const oscillator of voice?.oscillators ?? []) {
        oscillator.stop();
      }
      voice = null;
      lfo.stop();
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
      voice = strike(note, id, time);
    },
    output,
    update: (next) => {
      const previous = state;
      state = next;
      smooth(output.gain, volumeGain(next.volume) * VOICE_GAIN);
      smooth(drive.gain, driveGain(next.drive));
      smooth(trim.gain, registrationTrim(next));
      if (previous.rotary !== next.rotary) {
        const turn = ROTARY[next.rotary];
        const now = ctx.currentTime;
        lfo.frequency.setTargetAtTime(turn.rate, now, SPEED_TIME);
        swayLeft.gain.setTargetAtTime(turn.sway, now, SPEED_TIME);
        swayRight.gain.setTargetAtTime(-turn.sway, now, SPEED_TIME);
        tremoloLeft.gain.setTargetAtTime(turn.tremolo, now, SPEED_TIME);
        tremoloRight.gain.setTargetAtTime(-turn.tremolo, now, SPEED_TIME);
      }
      for (const [index, gain] of (voice?.levels ?? []).entries()) {
        smooth(gain.gain, partial(index));
      }
    },
  };
}
