import {
  PianoRoll,
  PianoRollGrid,
  PianoRollKeys,
  PianoRollStrip,
  PianoRollViewport,
} from "@/registry-audio/bases/base/audio/elements/piano-roll";
import {
  Timeline,
  TimelineMark,
  TimelinePlayhead,
  TimelineRuler,
} from "@/registry-audio/bases/base/audio/elements/timeline";
import { ramp } from "../motion.ts";

const STEPS_PER_BEAT = 4;
const STEPS = 32;
const STEPS_PER_SECOND = 8;
const MIN_PITCH = 60;
const MAX_PITCH = 79;
const BAR_STEPS = [0, 16];
/** Two bars: a bass line under an arpeggio, in sixteenths. */
const NOTES = [
  [60, 0, 4],
  [64, 4, 2],
  [67, 6, 2],
  [72, 8, 4],
  [71, 12, 2],
  [67, 14, 2],
  [65, 16, 4],
  [69, 20, 2],
  [72, 22, 2],
  [76, 24, 4],
  [74, 28, 2],
  [79, 30, 2],
].map(([pitch = 0, start = 0, length = 0], index) => ({
  id: index,
  length,
  pitch,
  start,
}));
const NOTE_STAGGER = 0.05;

/** A melody drawn in note by note, then played: the playing notes light up on the keys. */
export function PianoRollShowcase({ t }: { t: number }) {
  const notes = NOTES.filter(
    (_, index) => ramp(t - 0.1 - index * NOTE_STAGGER, 0.01) > 0
  );
  const playing = t > 0.8;
  const position = playing ? ((t - 0.8) * STEPS_PER_SECOND) % STEPS : 0;
  const active = playing
    ? notes
        .filter(
          (note) =>
            position >= note.start && position < note.start + note.length
        )
        .map((note) => note.pitch)
    : [];
  return (
    <Timeline
      className="h-full"
      duration={STEPS}
      position={position}
      snapStep={1}
    >
      <PianoRoll
        activePitches={active}
        className="h-full"
        maxPitch={MAX_PITCH}
        minPitch={MIN_PITCH}
        value={notes}
      >
        <PianoRollViewport>
          <PianoRollStrip className="border-b">
            <TimelineRuler
              aria-label="Playhead"
              className="h-5 border-b-0 text-[10px]"
            >
              {BAR_STEPS.map((step, bar) => (
                <TimelineMark className="ps-1" key={step} value={step}>
                  {bar + 1}
                </TimelineMark>
              ))}
              {playing ? <TimelinePlayhead /> : null}
            </TimelineRuler>
          </PianoRollStrip>
          <PianoRollStrip className="flex-1" lead={<PianoRollKeys />}>
            <PianoRollGrid
              accentStep={STEPS_PER_BEAT}
              aria-label="Notes"
              gridStep={1}
            >
              {playing ? <TimelinePlayhead /> : null}
            </PianoRollGrid>
          </PianoRollStrip>
        </PianoRollViewport>
      </PianoRoll>
    </Timeline>
  );
}
