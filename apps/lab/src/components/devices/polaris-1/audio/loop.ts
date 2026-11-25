import { triggerHihat, triggerKick } from "@/lib/drum-synthesis";

/**
 * The loop Polaris-1 drives: a bass line on a sawtooth under a kick and a
 * hi-hat, two bars at 96 BPM, rendered once into a buffer, as a file would
 * arrive. It is quiet and clean, so the drive is what you hear.
 */

const RATE = 44_100;
const BPM = 96;
const STEP = 60 / BPM / 4;
const STEPS = 32;
const hertz = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** The bass line, a note per step or a rest, in MIDI notes. */
const BASS = [
  36, 0, 36, 48, 0, 36, 0, 46, 36, 0, 36, 0, 43, 0, 46, 0, 34, 0, 34, 46, 0, 34,
  0, 44, 34, 0, 34, 0, 41, 0, 43, 0,
] as const;

function bassNote(
  ctx: OfflineAudioContext,
  out: AudioNode,
  at: number,
  note: number
) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const amp = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.value = hertz(note);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1800, at);
  filter.frequency.exponentialRampToValueAtTime(300, at + STEP * 1.5);
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(0.25, at + 0.005);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + STEP * 1.8);
  osc.connect(filter).connect(amp).connect(out);
  osc.start(at);
  osc.stop(at + STEP * 2);
}

export async function renderLoop(): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.round(STEP * STEPS * RATE), RATE);
  const out = ctx.createGain();
  out.gain.value = 0.5;
  out.connect(ctx.destination);
  for (let step = 0; step < STEPS; step += 1) {
    const at = step * STEP;
    const note = BASS[step];
    if (note > 0) {
      bassNote(ctx, out, at, note);
    }
    if (step % 4 === 0) {
      triggerKick(ctx, out, at);
    }
    if (step % 2 === 1) {
      triggerHihat(ctx, out, at, { decay: 0.03 });
    }
  }
  return await ctx.startRendering();
}
