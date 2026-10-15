import { createSource } from "@audio-ui/react";
import { useLayoutEffect, useState } from "react";
import { Piano } from "@/registry-audio/bases/base/audio/elements/piano";
import { SpectrumAnalyzer } from "@/registry-audio/bases/base/audio/elements/spectrum-analyzer";
import { noise } from "../motion.ts";

const POINTS = 160;
const MIN_HZ = 20;
const MAX_HZ = 20_000;
const FLOOR_DB = -100;
/** Where a sawtooth's fundamental sits; each harmonic falls 6 dB per octave below it. */
const LOUDEST_DB = -24;
/** How wide a harmonic looks on the analyzer, in semitones. */
const WIDTH = 0.7;
/** Enough harmonics to fill the axis, few enough to compute the peaks of every frame. */
const HARMONICS = 64;
/** The low-pass the harmonics go through: its corner, and how many dB an octave it takes above it. */
const LOW_PASS_HZ = 1500;
const LOW_PASS = 18;
/** The peak hold the element uses itself: held 1 s, then falling at 24 dB/s. */
const HOLD = 1;
const FALL = 24;
const FRAME = 1 / 60;

const START = 0.4;
/** C, Am, F, G: a bass note held, the chord arpeggiated above it, four notes a second. */
const CHORDS = [
  [36, 48, 52, 55],
  [33, 45, 48, 52],
  [29, 41, 45, 48],
  [31, 43, 47, 50],
];
const NOTE = 0.25;
const RELEASE = 0.08;

const HZ = Array.from(
  { length: POINTS },
  (_, point) => MIN_HZ * (MAX_HZ / MIN_HZ) ** (point / (POINTS - 1))
);
const hzOf = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

/** The notes sounding at `t`, with how long they have sounded and their level in dB. */
function notesAt(t: number): { db: number; pitch: number }[] {
  if (t < START) {
    return [];
  }
  const beat = (t - START) / NOTE;
  const chord = CHORDS[Math.floor(beat / 4) % CHORDS.length] ?? [];
  const age = (beat % 1) * NOTE;
  const bassAge = (beat % 4) * NOTE;
  const upper = chord[1 + (Math.floor(beat) % 3)] ?? 0;
  return [
    { db: -6 - 6 * bassAge, pitch: chord[0] ?? 0 },
    {
      db: -12 * age - (age > NOTE - RELEASE ? 300 * (age - NOTE + RELEASE) : 0),
      pitch: upper,
    },
  ];
}

/** The level of every point at `t`: each note's harmonics over a slightly moving noise floor. */
function spectrumAt(t: number, out: Float32Array) {
  const frame = Math.round(t / FRAME);
  for (let point = 0; point < POINTS; point += 1) {
    out[point] = FLOOR_DB + 6 + 4 * noise(point * 31 + frame);
  }
  for (const { db, pitch } of notesAt(t)) {
    const fundamental = hzOf(pitch);
    for (
      let harmonic = 1;
      harmonic <= HARMONICS && fundamental * harmonic < MAX_HZ;
      harmonic += 1
    ) {
      const at = fundamental * harmonic;
      // A sawtooth through a gentle low-pass: the top harmonics fade out instead of stopping short.
      const level =
        LOUDEST_DB +
        db -
        20 * Math.log10(harmonic) -
        LOW_PASS * Math.max(0, Math.log2(at / LOW_PASS_HZ));
      for (let point = 0; point < POINTS; point += 1) {
        const away = (12 * Math.log2((HZ[point] ?? 1) / at)) / WIDTH;
        if (Math.abs(away) < 4) {
          out[point] = Math.max(
            out[point] ?? FLOOR_DB,
            level - 8 * away * away
          );
        }
      }
    }
  }
  return out;
}

/** The peaks at `t`, from the frames before it: each level held `HOLD` seconds, then falling. */
function peaksAt(t: number, out: Float32Array) {
  out.fill(FLOOR_DB);
  const frame = new Float32Array(POINTS);
  const reach = HOLD + (-FLOOR_DB + LOUDEST_DB) / FALL;
  for (let back = 0; back <= reach; back += FRAME) {
    spectrumAt(t - back, frame);
    const drop = FALL * Math.max(0, back - HOLD);
    for (let point = 0; point < POINTS; point += 1) {
      out[point] = Math.max(out[point] ?? FLOOR_DB, (frame[point] ?? 0) - drop);
    }
  }
  return out;
}

/** An arpeggio over a held bass: each note lights its harmonics, and the peaks hold above them. */
export function SpectrumAnalyzerShowcase({ t }: { t: number }) {
  const [spectrum] = useState(() =>
    createSource<Float32Array>(new Float32Array(POINTS))
  );
  const [peaks] = useState(() =>
    createSource<Float32Array>(new Float32Array(POINTS))
  );
  // The traces are painted from their sources, outside React.
  useLayoutEffect(() => {
    spectrum.set(spectrumAt(t, spectrum.getSnapshot()));
    peaks.set(peaksAt(t, peaks.getSnapshot()));
  }, [peaks, spectrum, t]);
  const active = notesAt(t)
    .filter(({ db }) => db > -40)
    .map(({ pitch }) => pitch);
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <SpectrumAnalyzer aria-label="Spectrum" peaks={peaks} source={spectrum} />
      <Piano
        activeNotes={active}
        aria-label="Keyboard"
        maxPitch={59}
        minPitch={24}
        size="sm"
      />
    </div>
  );
}
