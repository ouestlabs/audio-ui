export interface EnvelopePoint {
  x: number;
  y: number;
}

const A4_FREQUENCY = 440;
const A4_MIDI_NOTE = 69;
export const SEMITONES_PER_OCTAVE = 12;

export function noteToFrequency(note: number): number {
  return A4_FREQUENCY * 2 ** ((note - A4_MIDI_NOTE) / SEMITONES_PER_OCTAVE);
}

/** Floor under which gain automation never ramps, exponential-style approach to silence without hitting exactly 0 (which some ramp curves reject) or an audible hard stop. */
export const MIN_GAIN = 0.0001;

/** Where an envelope's attack/decay phase ends and its release phase begins, as a fraction of the 0-1 curve. A note holds at the curve's value here for as long as the key is down. */
export const SUSTAIN_SPLIT_X = 0.5;

function valueAtX(points: EnvelopePoint[], x: number): number {
  const [first] = points;
  const last = points.at(-1);
  if (!(first && last)) {
    return 0;
  }
  if (x <= first.x) {
    return first.y;
  }
  if (x >= last.x) {
    return last.y;
  }
  for (const [index, point] of points.entries()) {
    const next = points[index + 1];
    if (next && x >= point.x && x <= next.x) {
      const span = next.x - point.x;
      const t = span === 0 ? 0 : (x - point.x) / span;
      return point.y + (next.y - point.y) * t;
    }
  }
  return last.y;
}

/** Extracts the [fromX, toX] slice of an envelope curve, interpolating exact boundary values, and remaps it to its own local 0-1 x range. */
export function sliceEnvelope(
  points: EnvelopePoint[],
  fromX: number,
  toX: number
): EnvelopePoint[] {
  const span = toX - fromX;
  const interior = points
    .filter((point) => point.x > fromX && point.x < toX)
    .map((point) => ({ x: (point.x - fromX) / span, y: point.y }));
  return [
    { x: 0, y: valueAtX(points, fromX) },
    ...interior,
    { x: 1, y: valueAtX(points, toX) },
  ];
}

/** Schedules a gain ramp through `points` (local 0-1 x) starting at `startTime`, stretched over `durationSeconds`, scaled by `peakGain`. Cancels any pending automation first so retriggering never clicks. */
export function scheduleEnvelopeRamp(
  gainParam: AudioParam,
  points: EnvelopePoint[],
  startTime: number,
  durationSeconds: number,
  peakGain: number,
  fromValue: number
): void {
  gainParam.cancelScheduledValues(startTime);
  gainParam.setValueAtTime(Math.max(fromValue, MIN_GAIN), startTime);
  for (const point of points) {
    gainParam.linearRampToValueAtTime(
      Math.max(point.y * peakGain, MIN_GAIN),
      startTime + point.x * durationSeconds
    );
  }
}
