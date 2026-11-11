"use client";

import {
  duplicateTime,
  fitNotesToScale,
  humanizeNotes,
  invertNotes,
  legatoNotes,
  moveNotes,
  type Note,
  type NoteId,
  type NoteLevel,
  type RollBounds,
  rampVelocity,
  reverseNotes,
  stretchNotes,
} from "@audio-ui/core/piano-roll";
import { pitchName } from "@audio-ui/core";
import {
  rollScale,
  type Scale,
  scalePitchClasses,
} from "@audio-ui/engine/pitch";
import type { PianoRoll as PianoRollPrimitive, Source } from "@audio-ui/react";
import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  ClipBox,
  type ClipMeter,
  ClipToggle,
  ClipView,
  formatBars,
  PositionField,
  useClipPlayhead,
} from "@/components/audio-ui/clip-view";
import {
  DrumStepEditor,
  type DrumStepPad,
} from "@/components/audio-ui/drum-step-editor";
import { Knob } from "@/components/audio-ui/knob";
import {
  PianoRoll,
  PianoRollGrid,
  PianoRollKeys,
  PianoRollSelectionSpan,
  PianoRollStretchHandle,
  PianoRollStrip,
  PianoRollVelocity,
  PianoRollVelocityScale,
  PianoRollViewport,
} from "@/components/audio-ui/piano-roll";
import {
  type KeyNote,
  ScaleMenu,
  ScaleMenuContent,
  ScaleMenuDetect,
  ScaleMenuName,
  ScaleMenuRoot,
  ScaleMenuToggle,
  ScaleMenuTrigger,
} from "@/components/audio-ui/scale-menu";
import {
  Timeline,
  TimelineLane,
  TimelineMark,
  TimelineNavigator,
  TimelinePlayhead,
  TimelineRange,
  TimelineRangeHandle,
  TimelineRuler,
} from "@/components/audio-ui/timeline";
import type {
  ClipScale,
  ClipSwing,
} from "@/lib/arrangement";

/** C1 to C7: the range a clip's notes can take, scrolled to where they are. */
const MIN_PITCH = 24;
const MAX_PITCH = 96;
/** The widest a sixteenth gets, in px. */
const MAX_STEP_PX = 64;
/**
 * The roll's height: 18rem whatever stretches the rolls around it, less or
 * more when the panel is given a height of its own, which it then fills. Flush
 * in the view, which is the frame: no border or corners of its own, whatever
 * the style gives a roll. Inline, so it outranks the style's rules.
 */
const ROLL_SIZE = Object.freeze({
  border: 0,
  borderRadius: 0,
  flex: "1 1 18rem",
  height: "auto",
  minHeight: 0,
});

/** Where a MIDI clip plays in its source, in seconds: what the Clip box's fields and the ruler's brace set. */
export interface MidiClipRegion {
  /** How long the clip plays. */
  length: number;
  /** The stretch of the source that repeats, or null when the clip plays it once. */
  loop: readonly [number, number] | null;
  /** Where in the source the clip starts playing. */
  offset: number;
  /** How long the source is. */
  sourceLength: number;
}

/** What the panel shows of a clip, the same from clip to clip. */
export interface MidiClipView {
  /** Whether the pen draws; off, it selects. */
  drawing: boolean;
  /** Whether the roll folds to the pitches it uses. */
  folded: boolean;
  /** What the lane under the roll edits. */
  level: NoteLevel;
  /** Whether a drum clip shows its steps, a row per pad, rather than its roll. @default true */
  steps?: boolean;
}

/** How the panel opens. */
export const MIDI_CLIP_VIEW: MidiClipView = {
  drawing: false,
  folded: false,
  level: "velocity",
};

interface MidiClipPanelProps {
  /** Whether the clip is on: off, it stays on its track and is not heard. Leave it out, with `onActiveChange`, for a panel without the switch. */
  active?: boolean;
  /** How long a bar lasts, in seconds: the ruler numbers each. */
  bar: number;
  /** How long a beat lasts, in seconds: a firmer grid line marks each. */
  beat: number;
  /** Controls beside the name, such as a close button. */
  children?: ReactNode;
  className?: string;
  /** Whether the panel is rolled up to its strip, controlled: keep it outside to hold it from clip to clip. Leave it out for the panel to keep its own. */
  collapsed?: boolean;
  /** The ids of its folded boxes ("midi:loop", "midi:notes"), controlled. */
  foldedBoxes?: readonly string[];
  /** The sound of the song's recordings the Scale box reads the key from too: a weight per pitch class, C to B, in seconds, such as each audio clip's `audioChroma` times how long it plays. */
  keyAudio?: readonly number[];
  /** The notes the Scale box reads the key from: every part of the song, as one part alone is often ambiguous. @default the clip's notes */
  keyNotes?: readonly KeyNote[];
  name: string;
  /** The clip's notes, in seconds from the start of its source. */
  notes: readonly Note[];
  /** The clip's switch was pressed. */
  onActiveChange?: (active: boolean) => void;
  /** The caret on the strip was pressed. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Which boxes are folded was changed. */
  onFoldedBoxesChange?: (folded: string[]) => void;
  /** Fires when a pitch stops sounding. */
  onNoteOff?: PianoRollPrimitive.Root.Props["onNoteOff"];
  /** Fires when a key is pressed or a note drawn: sound it. */
  onNoteOn?: PianoRollPrimitive.Root.Props["onNoteOn"];
  /** Fires on every change of the notes, as a drag goes. */
  onNotesChange: (notes: Note[]) => void;
  /** Fires once a change ends: the place to take an undo step. */
  onNotesCommitted?: () => void;
  /** A pad's name was pressed in the steps: sound it. */
  onPadOn?: (note: number) => void;
  /** Fires on every change of where the clip plays. Leave it out for a panel that only edits notes. */
  onRegionChange?: (region: MidiClipRegion) => void;
  /** A name was typed in the strip. */
  onRename?: (name: string) => void;
  /** A scale was picked, or turned on or off. Leave it out for a panel without the Scale box. */
  onScaleChange?: (scale: ClipScale) => void;
  /** The swing was turned, or its step changed; `null` plays the clip straight. Leave it out for a panel without the Groove box. */
  onSwingChange?: (swing: ClipSwing | null) => void;
  /** The pen, the roll's fold or the lane was changed. */
  onViewChange?: (view: MidiClipView) => void;
  /**
   * The pads of the drum rack that plays the clip, top to bottom: given, the
   * clip opens on its steps, a row per pad, and the roll names its keys after
   * them.
   */
  pads?: readonly DrumStepPad[];
  /** The arrangement's position, live: while it plays the clip, a playhead shows where in its notes, and the steps light the one playing. Leave it out for none. */
  position?: Source<number>;
  /** Where the clip plays in its source, and its loop. */
  region: MidiClipRegion;
  /** The clip's scale: on, its roll marks the scale's rows, and Fold keeps them. */
  scale?: ClipScale;
  /** Where the clip starts on the arrangement, what `position` is read against. @default 0 */
  start?: number;
  /** The grid notes are drawn and moved on, in seconds. @default a quarter of `beat` */
  step?: number;
  /** The clip's swing: its off-beats played late. */
  swing?: ClipSwing;
  /** The pen, the roll's fold and the lane, controlled: to keep them from clip to clip, or past a reload. */
  view?: MidiClipView;
}

/** What a Notes button does to the notes it acts on. */
type NotesEdit = (
  notes: Note[],
  ids: Set<NoteId>,
  bounds: RollBounds,
  loopEnd: number
) => Note[];

const NOTE_EDITS: { edit: NotesEdit; label: string; name: string }[] = [
  {
    edit: (notes, ids) => invertNotes(notes, ids),
    label: "Inv",
    name: "Invert",
  },
  {
    edit: (notes, ids) => reverseNotes(notes, ids),
    label: "Rev",
    name: "Reverse",
  },
  {
    edit: (notes, ids, bounds, loopEnd) =>
      legatoNotes(notes, ids, bounds.minLength, loopEnd),
    label: "Legato",
    name: "Legato",
  },
  {
    edit: (notes, ids, bounds) => stretchNotes(notes, ids, 2, bounds),
    label: "×2",
    name: "Twice as long",
  },
  {
    edit: (notes, ids, bounds) => stretchNotes(notes, ids, 0.5, bounds),
    label: "÷2",
    name: "Half as long",
  },
  {
    edit: (notes, ids, bounds) =>
      humanizeNotes(
        notes,
        ids,
        { timing: bounds.minLength / 4, velocity: 0.15 },
        bounds
      ),
    label: "Human",
    name: "Humanize",
  },
];
/** One value when they all agree, the two ends when they do not: the first note's would read as true of every one. */
function spread(values: readonly number[], format: (value: number) => string) {
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high ? format(low) : `${format(low)}–${format(high)}`;
}

/**
 * What the strip says of the selected notes, as label and value pairs: their
 * pitches, where they start and how long they last in the roll's own bars,
 * and how hard they play, from 1 to 127. Nothing else on the page reads them
 * out.
 */
export function noteSelectionReadout(
  selected: readonly Note[],
  meter: ClipMeter
): { label: string; value: string }[] {
  const start = Math.min(...selected.map((note) => note.start));
  const end = Math.max(...selected.map((note) => note.start + note.length));
  return [
    {
      label: "Pitch",
      value: spread(
        selected.map((note) => note.pitch),
        pitchName
      ),
    },
    { label: "Start", value: formatBars(start, meter) },
    { label: "Length", value: formatBars(end - start, meter, "length") },
    {
      label: "Velocity",
      value: spread(
        selected.map((note) =>
          Math.max(1, Math.round((note.velocity ?? 1) * 127))
        ),
        String
      ),
    },
  ];
}

const TRANSPOSE_STEPS = [-12, -1, 1, 12];

/** The pitch `steps` steps of `scale` from `pitch`, up for a positive count: a pitch out of the scale goes to the next one in it. */
function scaleStep(pitch: number, scale: Scale, steps: number): number {
  const classes = scalePitchClasses(scale);
  const direction = Math.sign(steps);
  let at = pitch;
  for (let left = Math.abs(steps); left > 0; ) {
    at += direction;
    if (classes.includes(((at % 12) + 12) % 12)) {
      left -= 1;
    }
  }
  return at;
}

/** Moves each note in `ids` by `steps` steps of `scale`; one that would leave the roll stays where it is. */
function stepNotes(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>,
  scale: Scale,
  steps: number,
  bounds: RollBounds
): Note[] {
  return notes.map((note) => {
    if (!ids.has(note.id)) {
      return note;
    }
    const pitch = scaleStep(note.pitch, scale, steps);
    return pitch < bounds.minPitch || pitch > bounds.maxPitch
      ? note
      : { ...note, pitch };
  });
}
const RAMPS = [
  { from: 0.3, label: "↗", name: "Crescendo", to: 1 },
  { from: 1, label: "↘", name: "Decrescendo", to: 0.3 },
];

/** The Loop box: the switch, where the loop sits and how long it is, halved or doubled, and its notes played again after it. */
function LoopBox({
  disabled,
  loop,
  meter,
  noteCount,
  offset,
  onCommit,
  onDouble,
  onDuplicate,
  onHalve,
  onLength,
  onPosition,
  onToggle,
  span,
  step,
  stretch,
}: {
  disabled: boolean;
  loop: readonly [number, number] | null;
  meter: { bar: number; beatsPerBar: number };
  noteCount: number;
  offset: number;
  onCommit?: () => void;
  onDouble: () => void;
  onDuplicate: () => void;
  onHalve: () => void;
  onLength: (seconds: number) => void;
  onPosition: (seconds: number) => void;
  onToggle: () => void;
  span: number;
  step: number;
  stretch: number;
}) {
  const enabled = !disabled;
  return (
    <ClipBox foldable id="midi:loop" title="Loop">
      <ClipToggle
        disabled={disabled}
        onClick={onToggle}
        pressed={Boolean(loop)}
      >
        Loop
      </ClipToggle>
      <PositionField
        disabled={!(enabled && loop)}
        label="Loop position"
        max={span}
        meter={meter}
        onChange={onPosition}
        onCommit={onCommit}
        shortLabel="Position"
        value={loop?.[0] ?? offset}
      />
      <PositionField
        disabled={!(enabled && loop)}
        kind="length"
        label="Loop length"
        meter={meter}
        min={step}
        onChange={onLength}
        onCommit={onCommit}
        shortLabel="Length"
        value={stretch}
      />
      <div className="grid grid-cols-2 gap-1">
        <ClipToggle
          aria-label="Halve the loop"
          disabled={!(enabled && loop)}
          onClick={onHalve}
        >
          ÷2
        </ClipToggle>
        <ClipToggle
          aria-label="Double the loop"
          disabled={!(enabled && loop)}
          onClick={onDouble}
        >
          ×2
        </ClipToggle>
      </div>
      <ClipToggle
        disabled={!(enabled && loop) || noteCount === 0}
        onClick={onDuplicate}
        title="Duplicate the loop's notes into a second pass"
      >
        Dupl. Loop
      </ClipToggle>
    </ClipBox>
  );
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

/** The Groove box: for a drum clip, its steps or its roll; the swing, and the step it swings, an eighth or a sixteenth. */
function GrooveBox({
  onCommit,
  onShowSteps,
  onSwingChange,
  steps,
  swing,
}: {
  onCommit?: () => void;
  /** Given for a drum clip: shows its steps, or with `false` its roll. */
  onShowSteps?: (steps: boolean) => void;
  onSwingChange?: (swing: ClipSwing | null) => void;
  steps: boolean;
  swing: ClipSwing | undefined;
}) {
  const division = swing?.division ?? 16;
  const turn = useCallback(
    (value: number | readonly number[]) => {
      const amount = Array.isArray(value) ? (value[0] ?? 0) : Number(value);
      onSwingChange?.(amount > 0 ? { amount, division } : null);
    },
    [division, onSwingChange]
  );
  const pickDivision = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const next = Number(event.currentTarget.dataset.division) as 8 | 16;
      if (swing) {
        onSwingChange?.({ ...swing, division: next });
        onCommit?.();
      }
    },
    [onCommit, onSwingChange, swing]
  );
  const showSteps = useCallback(() => onShowSteps?.(true), [onShowSteps]);
  const showRoll = useCallback(() => onShowSteps?.(false), [onShowSteps]);
  return (
    <ClipBox foldable id="midi:groove" title="Groove">
      {onShowSteps ? (
        <div className="grid grid-cols-2 gap-1">
          <ClipToggle onClick={showSteps} pressed={steps}>
            Steps
          </ClipToggle>
          <ClipToggle onClick={showRoll} pressed={!steps}>
            Roll
          </ClipToggle>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <Knob
          aria-label="Swing"
          disabled={!onSwingChange}
          formatValue={percent}
          max={1}
          min={0}
          onValueChange={turn}
          onValueCommitted={onCommit}
          size="sm"
          step={0.01}
          value={swing?.amount ?? 0}
          valueLabel="hidden"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[10px] text-muted-foreground leading-tight">
            Swing {percent(swing?.amount ?? 0)}
          </span>
          <div className="grid grid-cols-2 gap-1">
            {[8, 16].map((each) => (
              <ClipToggle
                aria-label={`Swing the ${each === 8 ? "eighths" : "sixteenths"}`}
                className="px-0"
                data-division={each}
                disabled={!(onSwingChange && swing)}
                key={each}
                onClick={pickDivision}
                pressed={division === each}
              >
                {each === 8 ? "8th" : "16th"}
              </ClipToggle>
            ))}
          </div>
        </div>
      </div>
    </ClipBox>
  );
}

const C_MAJOR: ClipScale = { name: "major", on: false, root: 0 };

/** The Scale box: the clip's scale picked from a menu, turned on or off, and the keys its song's notes are likeliest in. */
function ScaleBox({
  keyAudio,
  keyNotes,
  noteCount,
  onCommit,
  onFit,
  onScaleChange,
  scale = C_MAJOR,
}: {
  keyAudio?: readonly number[];
  keyNotes: readonly KeyNote[];
  noteCount: number;
  onCommit?: () => void;
  /** Moves the notes out of the scale onto its nearest pitch: the selected ones, or every one. */
  onFit: () => void;
  onScaleChange: (scale: ClipScale) => void;
  scale?: ClipScale;
}) {
  // A pick in the menu sets the scale and turns it on, then asks to turn it on: the second call reads what the first set, not the scale this render had.
  const latest = useRef(scale);
  latest.current = scale;
  const change = useCallback(
    (next: ClipScale) => {
      const was = latest.current;
      if (
        next.on === was.on &&
        next.name === was.name &&
        next.root === was.root
      ) {
        return;
      }
      latest.current = next;
      onScaleChange(next);
      onCommit?.();
    },
    [onCommit, onScaleChange]
  );
  const turn = useCallback(
    (on: boolean) => change({ ...latest.current, on }),
    [change]
  );
  const pick = useCallback(
    ({ name, root }: Scale) => change({ name, on: true, root }),
    [change]
  );
  return (
    <ClipBox foldable id="midi:scale" title="Scale">
      <ScaleMenu
        enabled={scale.on}
        onEnabledChange={turn}
        onScaleChange={pick}
        scale={scale}
      >
        <ScaleMenuTrigger className="h-6 w-full px-2 text-xs" size="xs" />
        <ScaleMenuContent align="start">
          <ScaleMenuToggle />
          <DropdownMenuSeparator />
          <ScaleMenuRoot />
          <ScaleMenuName />
          <DropdownMenuSeparator />
          <ScaleMenuDetect audio={keyAudio} notes={keyNotes} />
        </ScaleMenuContent>
      </ScaleMenu>
      <ClipToggle
        disabled={!scale.on || noteCount === 0}
        onClick={onFit}
        title="Move the notes out of the scale onto its nearest pitch"
      >
        Fit notes
      </ClipToggle>
    </ClipBox>
  );
}

/** The Notes box: transposing, the note operations and the velocity ramps, on the selected notes or every note. */
function NotesBox({
  noteCount,
  onEdit,
  onRamp,
  onTranspose,
  scaled,
  selected,
}: {
  noteCount: number;
  onEdit: (event: MouseEvent<HTMLButtonElement>) => void;
  onRamp: (event: MouseEvent<HTMLButtonElement>) => void;
  onTranspose: (event: MouseEvent<HTMLButtonElement>) => void;
  /** With the clip's scale on, -1 and +1 move by its steps. */
  scaled: boolean;
  selected: number;
}) {
  const stepName = scaled ? "a step of the scale" : "a semitone";
  return (
    <ClipBox foldable id="midi:notes" title="Notes">
      <p className="text-[10px] text-muted-foreground leading-tight">
        {selected > 0 ? `${selected} selected` : "All notes"}
      </p>
      <div className="grid grid-cols-4 gap-0.5">
        {TRANSPOSE_STEPS.map((semitones) => (
          <ClipToggle
            aria-label={`Transpose ${semitones > 0 ? "up" : "down"} ${Math.abs(semitones) === 12 ? "an octave" : stepName}`}
            className="px-0"
            data-semitones={semitones}
            disabled={noteCount === 0}
            key={semitones}
            onClick={onTranspose}
          >
            {semitones > 0 ? `+${semitones}` : String(semitones)}
          </ClipToggle>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {NOTE_EDITS.map((item, index) => (
          <ClipToggle
            aria-label={item.name}
            className="px-0"
            data-index={index}
            disabled={noteCount === 0}
            key={item.name}
            onClick={onEdit}
            title={item.name}
          >
            {item.label}
          </ClipToggle>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {RAMPS.map((ramp, index) => (
          <ClipToggle
            aria-label={ramp.name}
            data-index={index}
            disabled={noteCount === 0}
            key={ramp.name}
            onClick={onRamp}
            title={ramp.name}
          >
            {ramp.label}
          </ClipToggle>
        ))}
      </div>
    </ClipBox>
  );
}

/** The clip's piano roll: Draw at the top left, Fold above the keys (onto the scale's rows too when one is marked), the loop brace on the ruler, and a velocity or chance lane under the notes. */
function ClipRoll({
  bars,
  beat,
  drawing,
  folded,
  length,
  level,
  loop,
  name,
  offset,
  onNoteOff,
  onNoteOn,
  onNotesChange,
  onNotesCommitted,
  onRegionChange,
  padNames,
  playhead,
  playing,
  scale,
  selection,
  setBrace,
  setSelection,
  span,
  step,
  toggleDrawing,
  toggleFolded,
  toggleLevel,
  value,
}: {
  bars: readonly number[];
  beat: number;
  drawing: boolean;
  folded: boolean;
  length: number;
  level: NoteLevel;
  loop: readonly [number, number] | null;
  name: string;
  offset: number;
  onNoteOff?: PianoRollPrimitive.Root.Props["onNoteOff"];
  onNoteOn?: PianoRollPrimitive.Root.Props["onNoteOn"];
  onNotesChange: (notes: Note[]) => void;
  onNotesCommitted?: () => void;
  onRegionChange?: (region: MidiClipRegion) => void;
  padNames: Readonly<Record<number, string>> | undefined;
  playhead: Source<number> | undefined;
  playing: boolean;
  /** The scale whose rows are marked; `null` marks none. */
  scale: Scale | null;
  selection: readonly NoteId[];
  setBrace: (range: readonly [number, number]) => void;
  setSelection: (selection: readonly NoteId[]) => void;
  span: number;
  step: number;
  toggleDrawing: () => void;
  toggleFolded: () => void;
  toggleLevel: () => void;
  value: Note[];
}) {
  // Opens on the notes, or on middle C with none, each time it shows (key the panel by clip), and again when it folds or unfolds, as its rows change.
  const viewportRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef(60);
  centerRef.current =
    value.length > 0
      ? Math.round(
          value.reduce((sum, note) => sum + note.pitch, 0) / value.length
        )
      : 60;
  const scaleRows = scale ? `${scale.root} ${scale.name}` : "";
  const foldsTo = folded ? scaleRows : null;
  const rolled = useMemo(() => (scale ? rollScale(scale) : null), [scale]);
  useEffect(() => {
    const center = () => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }
      // A note is a toggle button of the grid: its pressed state is whether it is selected.
      const drawn = viewport.querySelectorAll(
        '[data-slot="piano-roll-grid"] [role="button"][aria-pressed]'
      );
      if (foldsTo !== null && drawn.length > 0) {
        // Folded, a row is not a pitch's place: the notes as drawn are.
        const top = viewport.getBoundingClientRect().top - viewport.scrollTop;
        let sum = 0;
        for (const note of drawn) {
          const box = note.getBoundingClientRect();
          sum += box.top + box.height / 2 - top;
        }
        viewport.scrollTop = sum / drawn.length - viewport.clientHeight / 2;
        return;
      }
      const row = (MAX_PITCH - centerRef.current) / (MAX_PITCH - MIN_PITCH + 1);
      viewport.scrollTop =
        row * viewport.scrollHeight - viewport.clientHeight / 2;
    };
    // Two frames later: the roll lays its rows out in a render of its own after this one.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(center);
    });
    return () => cancelAnimationFrame(frame);
  }, [foldsTo]);
  return (
    <Timeline
      className="min-h-0 min-w-0 flex-1"
      duration={span}
      maxZoom={MAX_STEP_PX / step}
      snapStep={step}
      source={playhead}
    >
      <PianoRoll
        drawStyle="paint"
        folded={folded && scale ? "scale" : folded}
        maxPitch={MAX_PITCH}
        minPitch={MIN_PITCH}
        mode={drawing ? "draw" : "select"}
        onNoteOff={onNoteOff}
        onNoteOn={onNoteOn}
        onSelectionChange={setSelection}
        onValueChange={onNotesChange}
        onValueCommitted={onNotesCommitted}
        scale={rolled}
        selection={selection}
        // Its own height, inline: a page that stretches the rolls it shows to fill it leaves this one be.
        style={ROLL_SIZE}
        value={value}
      >
        <PianoRollStrip
          className="border-b"
          lead={
            <Button
              aria-pressed={drawing}
              className="h-full w-full rounded-none text-[10px] uppercase tracking-wide"
              onClick={toggleDrawing}
              size="sm"
              type="button"
              variant={drawing ? "default" : "ghost"}
            >
              Draw
            </Button>
          }
        >
          <TimelineNavigator className="rounded-none" />
        </PianoRollStrip>
        <PianoRollViewport ref={viewportRef}>
          <PianoRollStrip
            className="border-b"
            lead={
              <Button
                aria-pressed={folded}
                className="h-full w-full rounded-none text-[10px] uppercase tracking-wide"
                onClick={toggleFolded}
                size="sm"
                type="button"
                variant={folded ? "default" : "ghost"}
              >
                Fold
              </Button>
            }
            sticky="top"
          >
            {/* The loop brace, or what the clip plays: drag it, or its ends. */}
            <TimelineLane className="h-5 bg-background">
              <TimelineRange
                aria-label={loop ? "Loop" : "Played"}
                onValueChange={onRegionChange ? setBrace : undefined}
                onValueCommitted={onNotesCommitted}
                value={loop ?? [offset, offset + length]}
              >
                <TimelineRangeHandle
                  aria-label={loop ? "Loop start" : "Clip start"}
                  edge="start"
                />
                <TimelineRangeHandle
                  aria-label={loop ? "Loop end" : "Clip end"}
                  edge="end"
                />
              </TimelineRange>
            </TimelineLane>
            <TimelineRuler
              aria-label="Position in the clip"
              className="h-4.5 border-b-0 text-[10px]"
            >
              {bars.map((at, index) => (
                <TimelineMark className="ps-1" key={at} value={at}>
                  {index + 1}
                </TimelineMark>
              ))}
              <PianoRollSelectionSpan className="bg-primary/25">
                <PianoRollStretchHandle edge="start" />
                <PianoRollStretchHandle edge="end" />
              </PianoRollSelectionSpan>
              {playing ? <TimelinePlayhead /> : null}
            </TimelineRuler>
          </PianoRollStrip>
          <PianoRollStrip
            className="flex-1"
            lead={<PianoRollKeys names={padNames} />}
          >
            <PianoRollGrid
              accentStep={beat}
              aria-label={`${name} notes`}
              gridStep={step}
            >
              {playing ? <TimelinePlayhead /> : null}
            </PianoRollGrid>
          </PianoRollStrip>
          <PianoRollStrip
            className="border-t"
            lead={
              <>
                <Button
                  aria-label={`Lane: ${level}, show ${level === "velocity" ? "chance" : "velocity"}`}
                  className="h-5 w-full shrink-0 rounded-none text-[9px] uppercase tracking-wide"
                  onClick={toggleLevel}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {level === "velocity" ? "Vel" : "Chance"}
                </Button>
                <PianoRollVelocityScale level={level} />
              </>
            }
            sticky="bottom"
          >
            <PianoRollVelocity
              accentStep={beat}
              gridStep={step}
              level={level}
            />
          </PianoRollStrip>
        </PianoRollViewport>
      </PianoRoll>
    </Timeline>
  );
}

/**
 * The clip view of an arrangement's MIDI clip, as a DAW's: a Clip box (its
 * switch and name, where it starts and ends in its source or with Loop on
 * the stretch that repeats, in bars.beats.sixteenths) and
 * a Notes box (transpose, invert, reverse, legato, ×2, ÷2, humanize and
 * velocity ramps, on the selected notes or every note) beside its piano roll,
 * and with `onScaleChange` a Scale box (the clip's scale, marked on the roll's
 * rows when on, and the keys `keyNotes` are likeliest in):
 * Draw at the top left, Fold above the keys (onto the scale's rows too when it is on), the loop brace on the ruler, and
 * a velocity or chance lane under the notes. Drawing paints a note a grid step
 * at a time; the notes are in seconds, from the start of the clip's source.
 * Key it by the clip, so it opens on each clip's notes.
 */
function MidiClipPanel({
  active,
  bar,
  beat,
  children,
  className,
  collapsed,
  foldedBoxes,
  keyAudio,
  keyNotes,
  onViewChange,
  view,
  name,
  notes,
  onActiveChange,
  onCollapsedChange,
  onFoldedBoxesChange,
  onNoteOff,
  onNoteOn,
  onNotesChange,
  onNotesCommitted,
  onPadOn,
  onRegionChange,
  onRename,
  onScaleChange,
  onSwingChange,
  pads,
  position,
  region,
  scale,
  start: clipStart = 0,
  step = beat / 4,
  swing,
}: MidiClipPanelProps) {
  const beatsPerBar = Math.round(bar / beat);
  const meter = useMemo(() => ({ bar, beatsPerBar }), [bar, beatsPerBar]);
  const { length, loop, offset, sourceLength } = region;
  // The roll covers the source, and what the clip plays past it.
  const span = Math.max(sourceLength, loop?.[1] ?? 0, offset + length);
  const [ownView, setOwnView] = useState<MidiClipView>(MIDI_CLIP_VIEW);
  const current = view ?? ownView;
  const { drawing, folded, level } = current;
  const changeView = useCallback(
    (patch: Partial<MidiClipView>) => {
      const next = { ...current, ...patch };
      setOwnView(next);
      onViewChange?.(next);
    },
    [current, onViewChange]
  );
  const [selection, setSelection] = useState<readonly NoteId[]>([]);
  const toggleDrawing = useCallback(
    () => changeView({ drawing: !drawing }),
    [changeView, drawing]
  );
  const toggleFolded = useCallback(
    () => changeView({ folded: !folded }),
    [changeView, folded]
  );
  const toggleLevel = useCallback(
    () => changeView({ level: level === "velocity" ? "chance" : "velocity" }),
    [changeView, level]
  );
  // A drum clip opens on its steps, a row per pad, unless its roll was asked for.
  const drums = pads && pads.length > 0 ? pads : undefined;
  const showSteps = Boolean(drums) && current.steps !== false;
  const setShowSteps = useCallback(
    (steps: boolean) => changeView({ steps }),
    [changeView]
  );
  // Where playback reads the notes, and the step it plays, from the arrangement's position.
  const { playhead, playing } = useClipPlayhead(position, {
    length,
    loop,
    offset,
    start: clipStart,
  });
  const stepFrom = loop?.[0] ?? offset;
  const playedStep = useMemo<Source<number> | undefined>(
    () =>
      playhead && {
        getSnapshot: () => {
          const time = playhead.getSnapshot();
          return time < 0 ? -1 : Math.floor((time - stepFrom) / step + 1e-6);
        },
        subscribe: playhead.subscribe,
      },
    [playhead, step, stepFrom]
  );
  const padNames = useMemo(
    () =>
      drums
        ? Object.fromEntries(drums.map((pad) => [pad.note, pad.name]))
        : undefined,
    [drums]
  );
  const value = useMemo(() => [...notes], [notes]);
  const bars = useMemo(
    () =>
      Array.from({ length: Math.ceil(span / bar) }, (_, index) => index * bar),
    [bar, span]
  );

  // The Notes box acts on the selected notes, or on every note with none selected.
  const editNotes = useCallback(
    (edit: (all: Note[], ids: Set<NoteId>, bounds: RollBounds) => Note[]) => {
      const all = [...notes];
      const ids = new Set(
        selection.length > 0 ? selection : all.map((note) => note.id)
      );
      onNotesChange(
        edit(all, ids, {
          duration: span,
          maxPitch: MAX_PITCH,
          minLength: step,
          minPitch: MIN_PITCH,
        })
      );
      onNotesCommitted?.();
    },
    [notes, onNotesChange, onNotesCommitted, selection, span, step]
  );
  const handleNoteEdit = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const item = NOTE_EDITS[Number(event.currentTarget.dataset.index)];
      if (item) {
        editNotes((all, ids, bounds) =>
          item.edit(all, ids, bounds, loop?.[1] ?? offset + length)
        );
      }
    },
    [editNotes, length, loop, offset]
  );
  // With the scale on, a step is a step of the scale; an octave stays twelve semitones.
  const marked = scale?.on ? scale : null;
  const handleTranspose = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const semitones = Number(event.currentTarget.dataset.semitones);
      editNotes((all, ids, bounds) =>
        marked && Math.abs(semitones) === 1
          ? stepNotes(all, ids, marked, semitones, bounds)
          : moveNotes(all, ids, 0, semitones, bounds)
      );
    },
    [editNotes, marked]
  );
  const fitToScale = useCallback(() => {
    if (marked) {
      editNotes((all, ids, bounds) =>
        fitNotesToScale(all, ids, rollScale(marked), bounds)
      );
    }
  }, [editNotes, marked]);
  const handleRamp = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const ramp = RAMPS[Number(event.currentTarget.dataset.index)];
      if (ramp) {
        editNotes((all, ids) => rampVelocity(all, ids, ramp.from, ramp.to));
      }
    },
    [editNotes]
  );

  // Where the clip plays: the fields and the brace.
  const setRegion = useCallback(
    (patch: Partial<MidiClipRegion>) =>
      onRegionChange?.({ ...region, ...patch }),
    [onRegionChange, region]
  );
  const setStart = useCallback(
    (start: number) =>
      setRegion(
        loop
          ? { offset: start }
          : { length: Math.max(step, offset + length - start), offset: start }
      ),
    [length, loop, offset, setRegion, step]
  );
  const setEnd = useCallback(
    (end: number) => setRegion({ length: Math.max(step, end - offset) }),
    [offset, setRegion, step]
  );
  const setLoopPosition = useCallback(
    (at: number) => loop && setRegion({ loop: [at, at + loop[1] - loop[0]] }),
    [loop, setRegion]
  );
  const setLoopLength = useCallback(
    (stretch: number) =>
      loop && setRegion({ loop: [loop[0], loop[0] + stretch] }),
    [loop, setRegion]
  );
  const toggleLoop = useCallback(() => {
    setRegion(
      loop
        ? { loop: null }
        : { loop: [offset, offset + Math.min(length, sourceLength - offset)] }
    );
    onNotesCommitted?.();
  }, [length, loop, offset, onNotesCommitted, setRegion, sourceLength]);
  const setBrace = useCallback(
    ([start, end]: readonly [number, number]) =>
      setRegion(
        loop ? { loop: [start, end] } : { length: end - start, offset: start }
      ),
    [loop, setRegion]
  );

  const halveLoop = useCallback(() => {
    if (loop) {
      setRegion({
        loop: [loop[0], loop[0] + Math.max(step, (loop[1] - loop[0]) / 2)],
      });
      onNotesCommitted?.();
    }
  }, [loop, onNotesCommitted, setRegion, step]);
  const doubleLoop = useCallback(() => {
    if (loop) {
      const end = loop[0] + (loop[1] - loop[0]) * 2;
      setRegion({
        loop: [loop[0], end],
        sourceLength: Math.max(sourceLength, end),
      });
      onNotesCommitted?.();
    }
  }, [loop, onNotesCommitted, setRegion, sourceLength]);
  // The loop's notes played again right after it, and the loop twice as long to hold them.
  const copies = useRef(0);
  const duplicateLoop = useCallback(() => {
    if (!loop) {
      return;
    }
    const [from, to] = loop;
    const end = to + (to - from);
    const { notes: next } = duplicateTime(
      [...notes],
      from,
      to,
      () => {
        copies.current += 1;
        return `copy-${copies.current}`;
      },
      Number.POSITIVE_INFINITY
    );
    onNotesChange(next);
    setRegion({ loop: [from, end], sourceLength: Math.max(sourceLength, end) });
    onNotesCommitted?.();
  }, [loop, notes, onNotesChange, onNotesCommitted, setRegion, sourceLength]);

  const loopSpan = loop ? loop[1] - loop[0] : length;
  const held = useMemo(() => {
    const ids = new Set<NoteId>(selection);
    return notes.filter((note) => ids.has(note.id));
  }, [notes, selection]);
  // With notes held, the strip reads them out: what they are is shown nowhere else.
  const status =
    held.length > 0 ? (
      <>
        <span>{`${held.length} of ${notes.length} selected`}</span>
        {noteSelectionReadout(held, meter).map((field) => (
          <span className="whitespace-nowrap" key={field.label}>
            {field.label} <span className="text-foreground">{field.value}</span>
          </span>
        ))}
      </>
    ) : (
      `${notes.length} ${notes.length === 1 ? "note" : "notes"}`
    );

  return (
    <ClipView
      actions={children}
      active={active}
      boxes={
        <>
          <ClipBox title="Clip">
            <PositionField
              disabled={!onRegionChange}
              label="Start"
              max={span}
              meter={meter}
              onChange={setStart}
              onCommit={onNotesCommitted}
              shortLabel="Start"
              value={offset}
            />
            <PositionField
              disabled={!onRegionChange}
              label="End"
              meter={meter}
              onChange={setEnd}
              onCommit={onNotesCommitted}
              shortLabel="End"
              value={offset + length}
            />
          </ClipBox>
          <LoopBox
            disabled={!onRegionChange}
            loop={loop}
            meter={meter}
            noteCount={notes.length}
            offset={offset}
            onCommit={onNotesCommitted}
            onDouble={doubleLoop}
            onDuplicate={duplicateLoop}
            onHalve={halveLoop}
            onLength={setLoopLength}
            onPosition={setLoopPosition}
            onToggle={toggleLoop}
            span={span}
            step={step}
            stretch={loopSpan}
          />
          {onSwingChange || drums ? (
            <GrooveBox
              onCommit={onNotesCommitted}
              onShowSteps={drums ? setShowSteps : undefined}
              onSwingChange={onSwingChange}
              steps={showSteps}
              swing={swing}
            />
          ) : null}
          {onScaleChange ? (
            <ScaleBox
              keyAudio={keyAudio}
              keyNotes={keyNotes ?? notes}
              noteCount={notes.length}
              onCommit={onNotesCommitted}
              onFit={fitToScale}
              onScaleChange={onScaleChange}
              scale={scale}
            />
          ) : null}
          <NotesBox
            noteCount={notes.length}
            onEdit={handleNoteEdit}
            onRamp={handleRamp}
            onTranspose={handleTranspose}
            scaled={marked !== null}
            selected={selection.length}
          />
        </>
      }
      className={className}
      collapsed={collapsed}
      data-slot="midi-clip-panel"
      foldedBoxes={foldedBoxes}
      name={name}
      onActiveChange={onActiveChange}
      onCollapsedChange={onCollapsedChange}
      onFoldedBoxesChange={onFoldedBoxesChange}
      onRename={onRename}
      status={status}
    >
      {drums && showSteps ? (
        <DrumStepEditor
          beatEvery={Math.max(1, Math.round(beat / step))}
          className="flex-1"
          notes={notes}
          onAudition={onPadOn}
          onNotesChange={onNotesChange}
          onNotesCommitted={onNotesCommitted}
          pads={drums}
          source={playedStep}
          start={stepFrom}
          step={step}
          steps={Math.max(1, Math.round(loopSpan / step))}
        />
      ) : (
        <ClipRoll
          bars={bars}
          beat={beat}
          drawing={drawing}
          folded={folded}
          length={length}
          level={level}
          loop={loop}
          name={name}
          offset={offset}
          onNoteOff={onNoteOff}
          onNoteOn={onNoteOn}
          onNotesChange={onNotesChange}
          onNotesCommitted={onNotesCommitted}
          onRegionChange={onRegionChange}
          padNames={padNames}
          playhead={playhead}
          playing={playing}
          scale={scale?.on ? scale : null}
          selection={selection}
          setBrace={setBrace}
          setSelection={setSelection}
          span={span}
          step={step}
          toggleDrawing={toggleDrawing}
          toggleFolded={toggleFolded}
          toggleLevel={toggleLevel}
          value={value}
        />
      )}
    </ClipView>
  );
}

export { MidiClipPanel, type MidiClipPanelProps };