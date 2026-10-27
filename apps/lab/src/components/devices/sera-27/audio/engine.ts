/**
 * The sound of Sera-27: a chord harp. Three sections play the chord held on
 * the buttons: the plate's strings, a soft chime each, struck one by one as a
 * finger crosses them and left to ring; the pad, a reedy organ that sustains
 * the chord while its button is down, and comes back as short stabs when the
 * rhythm runs; and the rhythm box, drums and an automatic bass on the chord's
 * root and fifth.
 *
 * The drums are the registry's synthesis. The controls speak in the panel's 0
 * to 10; each one is mapped here to the unit the node takes. Levels move with
 * ramps, and the engine plays into the bus it is attached to, which owns the
 * master level and the safety limiter.
 */

import { triggerHihat, triggerKick, triggerSnare } from "@/lib/drum-synthesis";

export type Param = "chords" | "harp" | "rhythm" | "sustain";
export type Settings = Record<Param, number>;

export const DEFAULTS: Settings = {
  chords: 6,
  harp: 7,
  rhythm: 6,
  sustain: 5,
};

/** A string's peak: a fast strum over all thirteen, ringing, stays under the bus's limiter. */
const STRING_GAIN = 0.11;
/** A pad note's level: four of them under a strum. */
const PAD_GAIN = 0.05;
const BASS_GAIN = 0.32;
/** Each drum's level into the rhythm section: the registry's voices start at full scale. */
const DRUMS = { hat: 0.16, kick: 0.6, snare: 0.32 } as const;
const PAD_ATTACK = 0.02;
const PAD_RELEASE = 0.1;
const STAB_SECONDS = 0.16;
const BASS_SECONDS = 0.38;
const SMOOTHING = 0.03;

const unit = (value: number) => value / 10;
const hertz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);
/** A section's level: silent at 0, a little under unity at 10, so a full strum over the rhythm and the pad stays under the bus's limiter. */
export const sectionGain = (value: number) => unit(value) ** 2 * 0.8;
/** How long a string rings, in seconds: a pluck at 0, a long chime at 10. */
export const sustainSeconds = (value: number) => 0.25 * 16 ** unit(value);

export type Drum = keyof typeof DRUMS;

interface Graph {
  chords: GainNode;
  ctx: BaseAudioContext;
  drums: Record<Drum, GainNode>;
  harp: GainNode;
  rhythm: GainNode;
}

export function createSeraEngine(initial: Settings = DEFAULTS) {
  const settings = { ...initial };
  let graph: Graph | null = null;
  let pad: { amp: GainNode; oscillators: OscillatorNode[] } | null = null;
  let unlock: (() => void) | null = null;

  const smooth = (param: AudioParam, value: number) => {
    if (graph) {
      param.setTargetAtTime(value, graph.ctx.currentTime, SMOOTHING);
    }
  };

  /** Wakes the shared context from a press: not awaited, since on a first press the promise can wait for the pointer's release. */
  function wake(ctx: BaseAudioContext) {
    if (ctx.state === "suspended" && "resume" in ctx) {
      (ctx as AudioContext).resume().catch(() => undefined);
      if (!unlock) {
        unlock = () => {
          (ctx as AudioContext).resume().catch(() => undefined);
        };
        document.addEventListener("pointerup", unlock, { once: true });
      }
    }
  }

  /** The reed of the pad and the stabs: two squares a hair apart, darkened, for each note. */
  function reeds(
    ctx: BaseAudioContext,
    notes: readonly number[],
    into: AudioNode
  ) {
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 1600;
    tone.Q.value = 0.4;
    tone.connect(into);
    const oscillators: OscillatorNode[] = [];
    for (const note of notes) {
      for (const detune of [-5, 5]) {
        const osc = ctx.createOscillator();
        osc.type = "square";
        osc.frequency.value = hertz(note);
        osc.detune.value = detune;
        osc.connect(tone);
        oscillators.push(osc);
      }
    }
    (oscillators[0] as OscillatorNode).onended = () => {
      for (const osc of oscillators) {
        osc.disconnect();
      }
      tone.disconnect();
    };
    return oscillators;
  }

  function releasePad(seconds: number) {
    if (!(graph && pad)) {
      return;
    }
    const now = graph.ctx.currentTime;
    const { amp, oscillators } = pad;
    amp.gain.cancelScheduledValues(now);
    amp.gain.setValueAtTime(amp.gain.value, now);
    amp.gain.setTargetAtTime(0, now, seconds / 4);
    for (const osc of oscillators) {
      osc.stop(now + seconds * 1.5);
    }
    (oscillators[0] as OscillatorNode).addEventListener("ended", () =>
      amp.disconnect()
    );
    pad = null;
  }

  return {
    /** Builds the three sections into `destination` (the bus): nothing sounds until a string, a chord or the rhythm. */
    attach(destination: AudioNode) {
      const ctx = destination.context;
      const section = (value: number) => {
        const gain = ctx.createGain();
        gain.gain.value = sectionGain(value);
        gain.connect(destination);
        return gain;
      };
      const rhythm = section(settings.rhythm);
      const drum = (level: number) => {
        const gain = ctx.createGain();
        gain.gain.value = level;
        gain.connect(rhythm);
        return gain;
      };
      graph = {
        chords: section(settings.chords),
        ctx,
        drums: {
          hat: drum(DRUMS.hat),
          kick: drum(DRUMS.kick),
          snare: drum(DRUMS.snare),
        },
        harp: section(settings.harp),
        rhythm,
      };
    },
    /** The bass on the beat: a round pluck at `time`. */
    bass(pitch: number, time: number) {
      if (!graph) {
        return;
      }
      const { ctx, rhythm } = graph;
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0, time);
      amp.gain.linearRampToValueAtTime(BASS_GAIN, time + 0.006);
      amp.gain.setTargetAtTime(0, time + 0.03, BASS_SECONDS / 4);
      amp.connect(rhythm);
      const body = ctx.createOscillator();
      body.type = "triangle";
      body.frequency.value = hertz(pitch);
      const sub = ctx.createOscillator();
      sub.frequency.value = hertz(pitch);
      for (const osc of [body, sub]) {
        osc.connect(amp);
        osc.start(time);
        osc.stop(time + BASS_SECONDS * 1.5);
      }
      sub.onended = () => {
        body.disconnect();
        sub.disconnect();
        amp.disconnect();
      };
    },
    /** Stops the pad and disconnects what this engine made; the shared context stays. */
    detach() {
      if (unlock) {
        document.removeEventListener("pointerup", unlock);
        unlock = null;
      }
      if (pad) {
        for (const osc of pad.oscillators) {
          osc.stop();
        }
        pad.amp.disconnect();
        pad = null;
      }
      if (graph) {
        graph.harp.disconnect();
        graph.chords.disconnect();
        graph.rhythm.disconnect();
      }
      graph = null;
    },
    /** A drum of the rhythm box at `time`, from the registry's synthesis. */
    drum(kind: Drum, time: number) {
      if (!graph) {
        return;
      }
      const into = graph.drums[kind];
      if (kind === "kick") {
        triggerKick(graph.ctx, into, time);
      } else if (kind === "snare") {
        triggerSnare(graph.ctx, into, time);
      } else {
        triggerHihat(graph.ctx, into, time);
      }
    },
    /** The pad holds a chord while its button is down; a new chord takes over from the last. */
    padOn(notes: readonly number[]) {
      if (!graph) {
        return;
      }
      const { chords, ctx } = graph;
      wake(ctx);
      releasePad(PAD_RELEASE / 2);
      const now = ctx.currentTime;
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0, now);
      amp.gain.setTargetAtTime(PAD_GAIN, now, PAD_ATTACK / 3);
      amp.connect(chords);
      const oscillators = reeds(ctx, notes, amp);
      for (const osc of oscillators) {
        osc.start(now);
      }
      pad = { amp, oscillators };
    },
    padOff() {
      releasePad(PAD_RELEASE);
    },
    /** A control moved: its section follows; the sustain takes the next string. */
    set(param: Param, value: number) {
      settings[param] = value;
      if (!graph || param === "sustain") {
        return;
      }
      smooth(graph[param].gain, sectionGain(value));
    },
    /** A short stab of the chord at `time`, as the rhythm box plays it. */
    stab(notes: readonly number[], time: number) {
      if (!graph) {
        return;
      }
      const { chords, ctx } = graph;
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0, time);
      amp.gain.linearRampToValueAtTime(PAD_GAIN, time + 0.008);
      amp.gain.setTargetAtTime(0, time + STAB_SECONDS * 0.6, STAB_SECONDS / 4);
      amp.connect(chords);
      const oscillators = reeds(ctx, notes, amp);
      for (const osc of oscillators) {
        osc.start(time);
        osc.stop(time + STAB_SECONDS * 2);
      }
      (oscillators[0] as OscillatorNode).addEventListener("ended", () =>
        amp.disconnect()
      );
    },
    /** One string of the plate, struck now: a triangle and its octave, quick to speak, left to ring. */
    strike(pitch: number) {
      if (!graph) {
        return;
      }
      const { ctx, harp } = graph;
      wake(ctx);
      const now = ctx.currentTime;
      const ring = sustainSeconds(settings.sustain);
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0, now);
      amp.gain.linearRampToValueAtTime(STRING_GAIN, now + 0.004);
      amp.gain.setTargetAtTime(0, now + 0.004, ring / 4);
      amp.connect(harp);
      const body = ctx.createOscillator();
      body.type = "triangle";
      body.frequency.value = hertz(pitch);
      const octave = ctx.createOscillator();
      octave.frequency.value = hertz(pitch) * 2;
      octave.detune.value = 3;
      const octaveLevel = ctx.createGain();
      octaveLevel.gain.value = 0.3;
      body.connect(amp);
      octave.connect(octaveLevel).connect(amp);
      for (const osc of [body, octave]) {
        osc.start(now);
        osc.stop(now + ring * 1.4 + 0.05);
      }
      body.onended = () => {
        body.disconnect();
        octave.disconnect();
        octaveLevel.disconnect();
        amp.disconnect();
      };
    },
  };
}

export type SeraEngine = ReturnType<typeof createSeraEngine>;
