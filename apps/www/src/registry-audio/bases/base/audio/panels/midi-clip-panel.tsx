"use client";

import {
  duplicateTime,
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
import type { PianoRoll as PianoRollPrimitive } from "@audio-ui/react";
import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/registry/bases/base/ui/button";
import {
  ClipBox,
  ClipRow,
  ClipToggle,
  ClipView,
  PositionField,
} from "@/registry-audio/bases/base/audio/elements/clip-view";
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
} from "@/registry-audio/bases/base/audio/elements/piano-roll";
import {
  Timeline,
  TimelineLane,
  TimelineMark,
  TimelineNavigator,
  TimelineRange,
  TimelineRangeHandle,
  TimelineRuler,
} from "@/registry-audio/bases/base/audio/elements/timeline";

/** C1 to C7: the range a clip's notes can take, scrolled to where they are. */
const MIN_PITCH = 24;
const MAX_PITCH = 96;
/** The widest a sixteenth gets, in px. */
const MAX_STEP_PX = 64;
/** The roll's height, fixed whatever stretches the rolls around it. */
const ROLL_SIZE = { flex: "none", height: "18rem" } as const;

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
  /** Fires on every change of where the clip plays. Leave it out for a panel that only edits notes. */
  onRegionChange?: (region: MidiClipRegion) => void;
  /** A name was typed in the strip. */
  onRename?: (name: string) => void;
  /** Where the clip plays in its source, and its loop. */
  region: MidiClipRegion;
  /** The grid notes are drawn and moved on, in seconds. @default a quarter of `beat` */
  step?: number;
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
const TRANSPOSE_STEPS = [-12, -1, 1, 12];
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
      <ClipRow label="Position">
        <PositionField
          disabled={!(enabled && loop)}
          label="Loop position"
          max={span}
          meter={meter}
          onChange={onPosition}
          onCommit={onCommit}
          value={loop?.[0] ?? offset}
        />
      </ClipRow>
      <ClipRow label="Length">
        <PositionField
          disabled={!(enabled && loop)}
          kind="length"
          label="Loop length"
          meter={meter}
          min={step}
          onChange={onLength}
          onCommit={onCommit}
          value={stretch}
        />
      </ClipRow>
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

/** The Notes box: transposing, the note operations and the velocity ramps, on the selected notes or every note. */
function NotesBox({
  noteCount,
  onEdit,
  onRamp,
  onTranspose,
  selected,
}: {
  noteCount: number;
  onEdit: (event: MouseEvent<HTMLButtonElement>) => void;
  onRamp: (event: MouseEvent<HTMLButtonElement>) => void;
  onTranspose: (event: MouseEvent<HTMLButtonElement>) => void;
  selected: number;
}) {
  return (
    <ClipBox foldable id="midi:notes" title="Notes">
      <p className="text-[10px] text-muted-foreground leading-tight">
        {selected > 0 ? `${selected} selected` : "All notes"}
      </p>
      <div className="grid grid-cols-4 gap-0.5">
        {TRANSPOSE_STEPS.map((semitones) => (
          <ClipToggle
            aria-label={`Transpose ${semitones > 0 ? "up" : "down"} ${Math.abs(semitones) === 12 ? "an octave" : "a semitone"}`}
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

/**
 * The clip view of an arrangement's MIDI clip, as a DAW's: a Clip box (its
 * switch and name, where it starts and ends in its source or with Loop on
 * the stretch that repeats, in bars.beats.sixteenths) and
 * a Notes box (transpose, invert, reverse, legato, ×2, ÷2, humanize and
 * velocity ramps, on the selected notes or every note) beside its piano roll:
 * Draw at the top left, Fold above the keys, the loop brace on the ruler, and
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
  name,
  notes,
  onActiveChange,
  onCollapsedChange,
  onFoldedBoxesChange,
  onNoteOff,
  onNoteOn,
  onNotesChange,
  onNotesCommitted,
  onRegionChange,
  onRename,
  region,
  step = beat / 4,
}: MidiClipPanelProps) {
  const beatsPerBar = Math.round(bar / beat);
  const meter = useMemo(() => ({ bar, beatsPerBar }), [bar, beatsPerBar]);
  const { length, loop, offset, sourceLength } = region;
  // The roll covers the source, and what the clip plays past it.
  const span = Math.max(sourceLength, loop?.[1] ?? 0, offset + length);
  const [drawing, setDrawing] = useState(true);
  const [folded, setFolded] = useState(false);
  const [level, setLevel] = useState<NoteLevel>("velocity");
  const [selection, setSelection] = useState<readonly NoteId[]>([]);
  const toggleDrawing = useCallback(() => setDrawing((on) => !on), []);
  const toggleFolded = useCallback(() => setFolded((on) => !on), []);
  const toggleLevel = useCallback(
    () => setLevel((on) => (on === "velocity" ? "chance" : "velocity")),
    []
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
  const handleTranspose = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const semitones = Number(event.currentTarget.dataset.semitones);
      editNotes((all, ids, bounds) =>
        moveNotes(all, ids, 0, semitones, bounds)
      );
    },
    [editNotes]
  );
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
    (position: number) =>
      loop && setRegion({ loop: [position, position + loop[1] - loop[0]] }),
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

  // Opens on the notes, or on middle C with none: once, when it mounts (key it by clip).
  const viewportRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef(60);
  centerRef.current =
    notes.length > 0
      ? Math.round(
          notes.reduce((sum, note) => sum + note.pitch, 0) / notes.length
        )
      : 60;
  useEffect(() => {
    // A frame later, once the roll has its rows laid out.
    const frame = requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }
      const row = (MAX_PITCH - centerRef.current) / (MAX_PITCH - MIN_PITCH + 1);
      viewport.scrollTop =
        row * viewport.scrollHeight - viewport.clientHeight / 2;
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const loopSpan = loop ? loop[1] - loop[0] : length;
  const status =
    selection.length > 0
      ? `${selection.length} of ${notes.length} selected`
      : `${notes.length} ${notes.length === 1 ? "note" : "notes"}`;

  return (
    <ClipView
      actions={children}
      active={active}
      boxes={
        <>
          <ClipBox title="Clip">
            <ClipRow label="Start">
              <PositionField
                disabled={!onRegionChange}
                label="Start"
                max={span}
                meter={meter}
                onChange={setStart}
                onCommit={onNotesCommitted}
                value={offset}
              />
            </ClipRow>
            <ClipRow label="End">
              <PositionField
                disabled={!onRegionChange}
                label="End"
                meter={meter}
                onChange={setEnd}
                onCommit={onNotesCommitted}
                value={offset + length}
              />
            </ClipRow>
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
          <NotesBox
            noteCount={notes.length}
            onEdit={handleNoteEdit}
            onRamp={handleRamp}
            onTranspose={handleTranspose}
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
      <Timeline
        className="min-w-0 flex-1"
        duration={span}
        maxZoom={MAX_STEP_PX / step}
        snapStep={step}
      >
        <PianoRoll
          drawStyle="paint"
          folded={folded}
          maxPitch={MAX_PITCH}
          minPitch={MIN_PITCH}
          mode={drawing ? "draw" : "select"}
          onNoteOff={onNoteOff}
          onNoteOn={onNoteOn}
          onSelectionChange={setSelection}
          onValueChange={onNotesChange}
          onValueCommitted={onNotesCommitted}
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
            <TimelineNavigator className="mx-2 my-1.5" />
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
              <TimelineLane className="h-4 bg-muted/40">
                <TimelineRange
                  aria-label={loop ? "Loop" : "Played"}
                  className="rounded-none bg-primary/70 ring-0"
                  onValueChange={onRegionChange ? setBrace : undefined}
                  onValueCommitted={onNotesCommitted}
                  value={loop ?? [offset, offset + length]}
                >
                  <TimelineRangeHandle
                    aria-label={loop ? "Loop start" : "Clip start"}
                    className="rounded-none bg-foreground/20 hover:bg-foreground/40"
                    edge="start"
                  />
                  <TimelineRangeHandle
                    aria-label={loop ? "Loop end" : "Clip end"}
                    className="rounded-none bg-foreground/20 hover:bg-foreground/40"
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
              </TimelineRuler>
            </PianoRollStrip>
            <PianoRollStrip className="flex-1" lead={<PianoRollKeys />}>
              <PianoRollGrid
                accentStep={beat}
                aria-label={`${name} notes`}
                gridStep={step}
              />
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
    </ClipView>
  );
}

export { MidiClipPanel, type MidiClipPanelProps };
