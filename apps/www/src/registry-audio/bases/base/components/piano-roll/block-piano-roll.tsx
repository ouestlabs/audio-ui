"use client";

import {
  findNotes,
  type Note,
  type NoteId,
  type NoteLevel,
  type NoteQuery,
  selectionSpan,
  toggleMuted,
} from "@audio-ui/core/piano-roll";
import { pitchClassName, type Scale } from "@audio-ui/core/pitch";
import type { Tempo } from "@audio-ui/core/time";
import {
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import { ButtonGroup } from "@/registry/bases/base/ui/button-group";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@/registry/bases/base/ui/dropdown-menu";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import {
  NoteEditMenu,
  NoteEditMenuContent,
  NoteEditMenuItems,
  NoteEditMenuSub,
  NoteEditMenuTrigger,
} from "@/registry-audio/bases/base/audio/elements/note-edit-menu";
import { NoteFind } from "@/registry-audio/bases/base/audio/elements/note-find";
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
  ScaleMenu,
  ScaleMenuContent,
  ScaleMenuName,
  ScaleMenuRoot,
  ScaleMenuToggle,
  ScaleMenuTrigger,
} from "@/registry-audio/bases/base/audio/elements/scale-menu";
import {
  Timeline,
  TimelineLane,
  TimelineMark,
  TimelineNavigator,
  TimelinePlayhead,
  TimelineRange,
  TimelineRangeHandle,
  TimelineRuler,
} from "@/registry-audio/bases/base/audio/elements/timeline";
import { Transport } from "@/registry-audio/bases/base/audio/elements/transport";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useMidiInput } from "@/registry-audio/bases/base/hooks/use-midi-input";
import {
  DEFAULT_NOTE_ENVELOPE,
  type Meter,
  meterOf,
  usePianoRollPlayback,
} from "@/registry-audio/bases/base/hooks/use-piano-roll-playback";
import { useSynthVoices } from "@/registry-audio/bases/base/hooks/use-synth-voices";
import type { TransportRegion } from "@/registry-audio/bases/base/hooks/use-transport-clock";
import { useUndoHistory } from "@/registry-audio/bases/base/hooks/use-undo-history";
import {
  downloadMidiFile,
  MIDI_FILE_ACCEPT,
  readMidiFile,
} from "@/registry-audio/bases/base/lib/midi-file";
import {
  applyNoteEdit,
  canApplyNoteEdit,
  type NoteEdit,
  noteEditForKey,
  PITCH_EDITS,
  PLAY_EDITS,
  TIME_EDITS,
  VELOCITY_EDITS,
} from "@/registry-audio/bases/base/lib/note-edits";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

/** C2 to C6: more than fits, so the roll scrolls and opens on middle C. */
const MIN_PITCH = 36;
const MAX_PITCH = 84;
const DEFAULT_VOLUME = 0.7;
/** The clip is four bars long, in whatever signature it is in. */
const BARS = 4;
/** The widest a step gets, in px: zoomed in all the way, a beat still shows its steps. */
const MAX_ZOOM = 64;
/** The room a ruler label needs, in px: bars, beats and sixteenths each get labels once they are this far apart. */
const LABEL_SPACING = 40;
/** The shortest a note gets from an edit: one step, the grid's. */
const MIN_LENGTH = 1;

const describeStep = (step: number) => `Step ${Math.floor(step) + 1}`;
/** "C4, step 5, 2 steps": where a note is, in the grid's own terms. */
const describeNote = (note: Note) =>
  `${pitchClassName(note.pitch)}${Math.floor(note.pitch / 12) - 1}, step ${note.start + 1}, ${note.length} ${note.length === 1 ? "step" : "steps"}`;

type LoopRegion = TransportRegion;

interface RulerMark {
  label: string;
  level: "bar" | "beat" | "step";
  step: number;
}

const DEPTH = { bar: 1, beat: 2, step: 3 } as const;

/** Where a step falls in its bar and beat, and which of the three it starts. */
function placeOf(step: number, meter: Meter) {
  const bar = Math.floor(step / meter.stepsPerBar);
  const inBar = step % meter.stepsPerBar;
  const beat = Math.floor(inBar / meter.stepsPerBeat);
  const inBeat = inBar % meter.stepsPerBeat;
  let level: RulerMark["level"] = "step";
  if (inBar === 0) {
    level = "bar";
  } else if (inBeat === 0) {
    level = "beat";
  }
  const label = [bar + 1, beat + 1, inBeat + 1]
    .slice(0, DEPTH[level])
    .join(".");
  return { bar, label, level };
}

/**
 * The ruler's labels at `unit` px a step: every bar, then every beat (1.2),
 * then every sixteenth (1.2.3), each once they are `LABEL_SPACING` apart.
 * Zoomed out further than bars allow, every second or fourth bar.
 */
function rulerMarks(unit: number, meter: Meter): RulerMark[] {
  let barEvery = 1;
  while (
    barEvery * meter.stepsPerBar * unit < LABEL_SPACING &&
    barEvery < BARS
  ) {
    barEvery *= 2;
  }
  const shown = {
    bar: true,
    beat: meter.stepsPerBeat * unit >= LABEL_SPACING,
    step: unit >= LABEL_SPACING,
  };
  const marks: RulerMark[] = [];
  for (let step = 0; step < meter.duration; step += 1) {
    const { bar, label, level } = placeOf(step, meter);
    if (shown[level] && (level !== "bar" || bar % barEvery === 0)) {
      marks.push({ label, level, step });
    }
  }
  return marks;
}

/** The px a step takes when the whole clip fits the view, the furthest out the roll zooms: the viewport's width past the keys, over the clip's steps. */
function useFitZoom(
  viewportRef: RefObject<HTMLDivElement | null>,
  duration: number
) {
  const [fit, setFit] = useState(0);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const measure = () => {
      const lead = viewport.querySelector<HTMLElement>(
        '[data-slot="piano-roll-strip"] > div'
      );
      setFit((viewport.clientWidth - (lead?.offsetWidth ?? 0)) / duration);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [duration, viewportRef]);
  return fit;
}

/** The ruler's labels follow the zoom: the grid's width over its steps is the px a step takes. */
function useStepWidth(duration: number) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [unit, setUnit] = useState(0);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setUnit((entry?.contentRect.width ?? 0) / duration);
    });
    observer.observe(grid);
    return () => observer.disconnect();
  }, [duration]);
  return { gridRef, unit };
}

/** The edits used most, at the top of the Notes menu where they are reached first. */
const TOP_EDITS = ["split", "join", "quantize", "mute"];
/** The Notes menu's submenus: the edits without a key of their own, by what they change. */
const EDIT_MENUS = [
  { edits: TIME_EDITS, label: "Time" },
  { edits: PITCH_EDITS, label: "Pitch" },
  { edits: VELOCITY_EDITS, label: "Velocity" },
  { edits: PLAY_EDITS, label: "Chance" },
].map((menu) => ({
  ...menu,
  edits: menu.edits.filter((item) => !TOP_EDITS.includes(item.id)),
}));
const KEYED_EDITS = [...TIME_EDITS, ...PLAY_EDITS].filter((item) =>
  TOP_EDITS.includes(item.id)
);

/** Whether a key press belongs to a field or a menu, which keep their keys. */
function typedIntoControl(event: { target: EventTarget | null }) {
  const target = event.target as HTMLElement | null;
  return Boolean(
    target?.closest("input, textarea, select, [role=menu], [role=listbox]")
  );
}

/** Cuts the notes past a clip's new end: what a shorter signature leaves out. */
function notesWithin(notes: Note[], duration: number): Note[] {
  return notes
    .filter((note) => note.start < duration)
    .map((note) => ({
      ...note,
      length: Math.min(note.length, duration - note.start),
    }));
}

export default function BlockPianoRoll() {
  const volumeId = useId();
  const volumeLabelId = useId();
  const volumeValueId = useId();
  const helpId = useId();

  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  /** Folded, only the pitches carrying notes get a row (F). */
  const [folded, setFolded] = useState(false);
  const toggleFolded = useCallback(() => setFolded((current) => !current), []);
  const [drawing, setDrawing] = useState(true);
  /** What the lane under the grid shows and edits: each note's velocity, or its chance. */
  const [laneLevel, setLaneLevel] = useState<NoteLevel>("velocity");
  const toggleLaneLevel = useCallback(
    () =>
      setLaneLevel((current) =>
        current === "velocity" ? "chance" : "velocity"
      ),
    []
  );
  const toggleDrawing = useCallback(
    () => setDrawing((current) => !current),
    []
  );
  const [scaleOn, setScaleOn] = useState(false);
  /** Limited to the scale, only its rows and the notes' get a row (G): it marks the scale too. */
  const [scaleOnly, setScaleOnly] = useState(false);
  const toggleScaleOnly = useCallback((on: boolean) => {
    setScaleOnly(on);
    if (on) {
      setScaleOn(true);
    }
  }, []);
  const [scaleChoice, setScaleChoice] = useState<Scale>({
    name: "major",
    root: 0,
  });
  const scale = scaleOn ? scaleChoice : null;
  const [selection, setSelection] = useState<readonly NoteId[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  // Opens on middle C, halfway down the range.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2;
    }
  }, []);
  const [tempo, setTempo] = useState<Tempo>({
    beatsPerBar: 4,
    beatUnit: 4,
    bpm: 120,
  });
  const meter = useMemo(() => meterOf(tempo, BARS), [tempo]);
  const [looping, setLooping] = useState(true);
  /** Px a step, once zoomed from the keys or the navigator; null fits the clip. */
  const [zoomed, setZoomed] = useState<number | null>(null);
  const fit = useFitZoom(viewportRef, meter.duration);
  const [metronome, setMetronome] = useState(false);
  const [loopRegion, setLoopRegion] = useState<LoopRegion | null>(null);
  const loopRange: readonly [number, number] = loopRegion
    ? [loopRegion.start, loopRegion.end]
    : [0, meter.duration];
  /** The loop range moves freely under the pointer; the loop itself is in whole steps. */
  const changeLoopRegion = useCallback(
    ([start, end]: readonly [number, number]) => {
      setLoopRegion({ end: Math.round(end), start: Math.round(start) });
    },
    []
  );
  const masterGain = useMasterBus(volume);

  const voices = useSynthVoices({ destination: masterGain });
  const { releaseNote, triggerNote } = voices;

  const [notes, setNotes] = useState<Note[]>([]);
  const history = useUndoHistory(notes, setNotes);
  const {
    clock,
    commitLoopRegion,
    isPlaying,
    onNoteOff,
    onNoteOn,
    pause,
    play,
    playingPitches,
    position,
    seek,
    stop,
  } = usePianoRollPlayback({
    destination: masterGain,
    looping,
    loopRegion,
    meter,
    metronome,
    notes,
    tempo,
    voices,
  });

  // A MIDI keyboard plays the roll's voices and lights its keys, once the page's MIDI input is connected.
  const midiNoteOn = useCallback(
    (pitch: number, velocity: number) => {
      const ctx = webAudio.getContext();
      if (ctx?.state === "suspended") {
        ctx.resume();
      }
      triggerNote(pitch, DEFAULT_NOTE_ENVELOPE, velocity);
    },
    [triggerNote]
  );
  const midiNoteOff = useCallback(
    (pitch: number) => releaseNote(pitch, DEFAULT_NOTE_ENVELOPE),
    [releaseNote]
  );
  const midi = useMidiInput({ onNoteOff: midiNoteOff, onNoteOn: midiNoteOn });
  const activePitches = useMemo(
    () => [...playingPitches, ...midi.activeNotes],
    [midi.activeNotes, playingPitches]
  );

  /** A double-click on the loop goes back to looping the whole clip. */
  const clearLoopRegion = useCallback(() => {
    setLoopRegion(null);
    commitLoopRegion();
  }, [commitLoopRegion]);

  const playPause = isPlaying ? pause : play;

  /** A new signature lays the clip out in its own bars: notes past its new end go, and the loop goes back to the whole clip. */
  const changeTempo = useCallback(
    (next: Tempo) => {
      const { duration } = meterOf(next, BARS);
      if (duration !== meter.duration) {
        setLoopRegion(null);
        if (notes.some((note) => note.start + note.length > duration)) {
          history.edit(notesWithin(notes, duration));
        }
      }
      setTempo(next);
    },
    [history, meter.duration, notes]
  );

  const nextIdRef = useRef(0);
  const applyEdit = useCallback(
    (item: NoteEdit) => {
      const next = applyNoteEdit(item, notes, selection, {
        at: position.getSnapshot(),
        bounds: {
          duration: meter.duration,
          maxPitch: MAX_PITCH,
          minLength: MIN_LENGTH,
          minPitch: MIN_PITCH,
        },
        loopEnd: loopRegion?.end ?? meter.duration,
        nextId: () => {
          nextIdRef.current += 1;
          return `edit-${nextIdRef.current}`;
        },
        scale,
      });
      history.edit(next);
    },
    [history, loopRegion, meter.duration, notes, position, scale, selection]
  );
  const isEditDisabled = useCallback(
    (item: NoteEdit) =>
      !canApplyNoteEdit(item, {
        hasNotes: notes.length > 0,
        hasScale: scale !== null,
        hasSelection: selection.length > 0,
      }),
    [notes.length, scale, selection.length]
  );

  /** A zoom out to the whole clip, or past it, goes back to fitting it. */
  const changeZoom = useCallback(
    (zoom: number) => setZoomed(zoom > fit + 0.01 ? zoom : null),
    [fit]
  );
  /** Zooms so `start` to `end` fills the view, and scrolls it into place. */
  const zoomOnto = useCallback(
    (start: number, end: number) => {
      const viewport = viewportRef.current;
      if (!viewport || end <= start) {
        return;
      }
      const zoom = Math.min(MAX_ZOOM, (fit * meter.duration) / (end - start));
      changeZoom(zoom);
      requestAnimationFrame(() => {
        viewport.scrollLeft = start * zoom;
      });
    },
    [changeZoom, fit, meter.duration]
  );
  /** Onto the selected notes, or the loop with none. */
  const zoomToSelection = () => {
    const span = selectionSpan(notes, new Set(selection));
    const [start, end] = span ? [span.start, span.end] : loopRange;
    zoomOnto(start, end);
  };
  const zoomOut = () => setZoomed(null);
  /** Selects the notes a Find query matches, in the scale marked when it asks for one. */
  const findAndSelect = useCallback(
    (query: NoteQuery) => setSelection(findNotes(notes, query)),
    [notes]
  );
  /** Selects the notes that are not selected, and deselects those that are. */
  const invertSelection = useCallback(() => {
    const selected = new Set(selection);
    setSelection(
      notes.filter((note) => !selected.has(note.id)).map((note) => note.id)
    );
  }, [notes, selection]);
  /** Cmd/Ctrl with Z undoes (with Shift, redoes), with Shift + A inverts the selection, with E, J and U split, join and quantize. */
  const commandKey = (key: string, shiftKey: boolean) => {
    if (key === "z") {
      if (shiftKey) {
        history.redo();
      } else {
        history.undo();
      }
      return true;
    }
    if (key === "a" && shiftKey) {
      invertSelection();
      return true;
    }
    const item = noteEditForKey(key, shiftKey);
    if (item && !isEditDisabled(item)) {
      applyEdit(item);
      return true;
    }
    return false;
  };
  /** B draws, F folds onto the notes, G limits the rows to the scale and K marks it, 0 deactivates the selection, Z zooms onto it and X out to the whole clip. */
  const plainKeys: Record<string, (() => void) | undefined> = {
    0: () => {
      if (selection.length > 0) {
        history.edit(toggleMuted(notes, new Set(selection)));
      }
    },
    b: toggleDrawing,
    f: toggleFolded,
    g: () => toggleScaleOnly(!scaleOnly),
    k: () => setScaleOn((current) => !current),
    x: zoomOut,
    z: zoomToSelection,
  };
  const plainKey = (key: string) => {
    const action = plainKeys[key];
    action?.();
    return action !== undefined;
  };
  /** The editor's keys, from anywhere inside it. */
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.altKey || typedIntoControl(event)) {
      return;
    }
    const key = event.key.toLowerCase();
    const handled =
      event.metaKey || event.ctrlKey
        ? commandKey(key, event.shiftKey)
        : plainKey(key);
    if (handled) {
      event.preventDefault();
    }
  };

  useEffect(() => {
    const handleSpace = (e: KeyboardEvent) => {
      // A note takes Space for itself, to select it.
      if (e.code !== "Space" || e.defaultPrevented) {
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") {
        return;
      }
      e.preventDefault();
      playPause();
    };
    window.addEventListener("keydown", handleSpace);
    return () => window.removeEventListener("keydown", handleSpace);
  }, [playPause]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const importMidiFile = useCallback(
    async (file: File) => {
      const imported = await readMidiFile(file, {
        duration: meter.duration,
        maxPitch: MAX_PITCH,
        minPitch: MIN_PITCH,
      });
      stop();
      history.edit(imported.notes);
      setTempo((current) => ({ ...current, bpm: imported.bpm }));
    },
    [history, meter.duration, stop]
  );

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) {
        importMidiFile(file);
      }
    },
    [importMidiFile]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes("Files")) {
      return;
    }
    e.preventDefault();
    setIsDraggingFile(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) {
      return;
    }
    setIsDraggingFile(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      const [file] = e.dataTransfer.files;
      if (!file) {
        return;
      }
      e.preventDefault();
      setIsDraggingFile(false);
      importMidiFile(file);
    },
    [importMidiFile]
  );

  const handleExport = useCallback(
    () =>
      downloadMidiFile(notes, { bpm: tempo.bpm, filename: "piano-roll.mid" }),
    [notes, tempo.bpm]
  );
  const clearNotes = useCallback(() => history.edit([]), [history]);

  const { gridRef, unit } = useStepWidth(meter.duration);
  const marks = useMemo(() => rulerMarks(unit, meter), [meter, unit]);

  return (
    <div
      className="cn-audio-panel @container/panel relative flex w-full min-w-0 flex-col gap-4 border bg-card p-4"
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      role="group"
    >
      <input
        accept={MIDI_FILE_ACCEPT}
        className="sr-only"
        onChange={handleFileInputChange}
        ref={fileInputRef}
        type="file"
      />
      {isDraggingFile ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] border-2 border-primary border-dashed bg-background/80 font-medium text-sm"
        >
          Drop a MIDI file to import
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2 p-1">
        <Transport
          className="min-w-0 flex-1 flex-nowrap"
          looping={looping}
          metronome={metronome}
          onLoopingChange={setLooping}
          onMetronomeChange={setMetronome}
          onPlayPause={playPause}
          onStop={stop}
          onTempoChange={changeTempo}
          playing={isPlaying}
          source={clock}
          tempo={tempo}
        />
        <div className="flex shrink-0 items-center gap-2">
          <ButtonGroup className="hidden @3xl/panel:flex">
            <Button
              aria-label="Undo"
              disabled={!history.canUndo}
              onClick={history.undo}
              size="icon"
              variant="outline"
            >
              <IconPlaceholder
                hugeicons="Undo02Icon"
                lucide="Undo2Icon"
                phosphor="ArrowUUpLeftIcon"
                remixicon="RiArrowGoBackLine"
                tabler="IconArrowBackUp"
              />
            </Button>
            <Button
              aria-label="Redo"
              disabled={!history.canRedo}
              onClick={history.redo}
              size="icon"
              variant="outline"
            >
              <IconPlaceholder
                hugeicons="Redo02Icon"
                lucide="Redo2Icon"
                phosphor="ArrowUUpRightIcon"
                remixicon="RiArrowGoForwardLine"
                tabler="IconArrowForwardUp"
              />
            </Button>
          </ButtonGroup>
          <ButtonGroup>
            <Button
              aria-label="Draw"
              aria-pressed={drawing}
              onClick={toggleDrawing}
              size="icon"
              title="Draw (B)"
              variant={drawing ? "default" : "outline"}
            >
              <IconPlaceholder
                hugeicons="PencilEdit01Icon"
                lucide="PencilIcon"
                phosphor="PencilSimpleIcon"
                remixicon="RiPencilLine"
                tabler="IconPencil"
              />
            </Button>
            <ScaleMenu
              enabled={scaleOn}
              onEnabledChange={setScaleOn}
              onScaleChange={setScaleChoice}
              scale={scaleChoice}
            >
              <ScaleMenuTrigger />
              <ScaleMenuContent>
                <ScaleMenuToggle>
                  Mark the scale
                  <DropdownMenuShortcut>K</DropdownMenuShortcut>
                </ScaleMenuToggle>
                <DropdownMenuCheckboxItem
                  checked={scaleOnly}
                  onCheckedChange={toggleScaleOnly}
                >
                  Only its rows
                  <DropdownMenuShortcut>G</DropdownMenuShortcut>
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <ScaleMenuRoot />
                <ScaleMenuName />
              </ScaleMenuContent>
            </ScaleMenu>
            <NoteFind onFind={findAndSelect} scale={scale} />
            <NoteEditMenu disabled={isEditDisabled} onEdit={applyEdit}>
              <NoteEditMenuTrigger />
              <NoteEditMenuContent>
                <DropdownMenuGroup>
                  <NoteEditMenuItems edits={KEYED_EDITS} />
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {EDIT_MENUS.map((menu) => (
                    <NoteEditMenuSub
                      edits={menu.edits}
                      key={menu.label}
                      label={menu.label}
                    />
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={handleImport}>
                    Import a MIDI file
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={notes.length === 0}
                    onClick={handleExport}
                  >
                    Export as a MIDI file
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={notes.length === 0}
                    onClick={clearNotes}
                    variant="destructive"
                  >
                    Clear
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </NoteEditMenuContent>
            </NoteEditMenu>
          </ButtonGroup>
        </div>
      </div>
      <Timeline
        duration={meter.duration}
        maxZoom={MAX_ZOOM}
        minZoom={fit}
        onPositionChange={seek}
        onZoomChange={changeZoom}
        snapStep={1}
        source={position}
        // Always held here, never below the whole clip: once measured, fitting it is a zoom like any other.
        zoom={fit > 0 ? Math.max(zoomed ?? fit, fit) : undefined}
      >
        <PianoRoll
          activePitches={activePitches}
          className="h-104"
          drawStyle="paint"
          folded={scaleOnly && scale ? "scale" : folded}
          getNoteLabel={describeNote}
          maxPitch={MAX_PITCH}
          minPitch={MIN_PITCH}
          mode={drawing ? "draw" : "select"}
          onNoteOff={onNoteOff}
          onNoteOn={onNoteOn}
          onSelectionChange={setSelection}
          onValueChange={history.change}
          onValueCommitted={history.commit}
          scale={scale}
          selection={selection}
          value={notes}
        >
          <PianoRollStrip className="border-b">
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
              <TimelineLane className="h-5.5 cursor-cell bg-muted/40">
                <TimelineRange
                  aria-label="Loop region"
                  className={cn(
                    "rounded-none bg-primary/70 ring-0",
                    !looping && "opacity-40"
                  )}
                  drawable
                  getAriaValueText={describeStep}
                  onDoubleClick={clearLoopRegion}
                  onValueChange={changeLoopRegion}
                  onValueCommitted={commitLoopRegion}
                  value={loopRange}
                >
                  <TimelineRangeHandle
                    aria-label="Loop start"
                    className="rounded-none bg-foreground/20 hover:bg-foreground/40"
                    edge="start"
                  />
                  <TimelineRangeHandle
                    aria-label="Loop end"
                    className="rounded-none bg-foreground/20 hover:bg-foreground/40"
                    edge="end"
                  />
                </TimelineRange>
              </TimelineLane>
              <TimelineRuler
                aria-label="Playhead"
                className="h-4.5 border-b-0 text-[10px]"
                getAriaValueText={describeStep}
              >
                {marks.map((mark) => (
                  <TimelineMark
                    className={cn(
                      "ps-1",
                      mark.level !== "bar" && "text-muted-foreground"
                    )}
                    key={mark.step}
                    value={mark.step}
                  >
                    {mark.label}
                  </TimelineMark>
                ))}
                <PianoRollSelectionSpan className="bg-primary/25">
                  <PianoRollStretchHandle edge="start" />
                  <PianoRollStretchHandle edge="end" />
                </PianoRollSelectionSpan>
                <TimelinePlayhead />
              </TimelineRuler>
            </PianoRollStrip>
            <PianoRollStrip className="flex-1" lead={<PianoRollKeys />}>
              <PianoRollGrid
                accentStep={meter.stepsPerBeat}
                aria-describedby={helpId}
                aria-label="Notes"
                gridStep={1}
                ref={gridRef}
              >
                <TimelinePlayhead />
              </PianoRollGrid>
            </PianoRollStrip>
            <PianoRollStrip
              className="border-t"
              lead={
                <>
                  <Button
                    aria-label={`Lane: ${laneLevel}, show ${laneLevel === "velocity" ? "chance" : "velocity"}`}
                    className="h-5 w-full shrink-0 rounded-none text-[9px] uppercase tracking-wide"
                    onClick={toggleLaneLevel}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {laneLevel === "velocity" ? "Vel" : "Chance"}
                  </Button>
                  <PianoRollVelocityScale level={laneLevel} />
                </>
              }
              sticky="bottom"
            >
              <PianoRollVelocity
                accentStep={meter.stepsPerBeat}
                gridStep={1}
                level={laneLevel}
              />
            </PianoRollStrip>
          </PianoRollViewport>
        </PianoRoll>
      </Timeline>
      <p className="sr-only" id={helpId}>
        With drawing on (B), drag across the grid to paint notes, one a grid
        step, following the pointer's pitch or with Alt keeping the first; drag
        across the velocity or chance lane to paint each bar to the pointer's
        height. With drawing off, drag to select. Drag a note to move it, with
        Alt to copy it, and drag its edges to change its length; drag an edge of
        the selection on the ruler to stretch it in time. Shift and a click adds
        a note to the selection; Shift and a key selects every note on its row.
        Cmd or Ctrl and a drag on a velocity bar sets how far it may stray. The
        arrow keys move the focused note, Shift with Left or Right changes its
        length, Shift with Up or Down moves it an octave, and Delete removes it.
        Cmd or Ctrl with E chops the selection on the grid, or splits the notes
        at the playhead, with J joins, with U quantizes, with I inserts the
        selection's time, with Shift and D duplicates it, with Shift and Delete
        deletes it, with Shift and A inverts the selection, and with Z undoes. 0
        deactivates the selection, F folds onto the notes, K marks the scale and
        G keeps only its rows, Z zooms onto the selection and X out.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div aria-label="Volume" className="flex-1" role="group">
          <div className="flex w-full min-w-0 flex-col gap-3">
            <div className="flex w-full min-w-0 items-center justify-between gap-4 [&>*:not(output):not(span)]:min-w-0 [&>*:not(output):not(span)]:flex-1">
              <span
                className="text-center text-muted-foreground text-xs"
                id={volumeLabelId}
              >
                Volume
              </span>
              <Fader
                aria-describedby={volumeValueId}
                aria-labelledby={volumeLabelId}
                id={volumeId}
                max={1}
                min={0}
                onValueChange={setVolume}
                orientation="horizontal"
                step={0.01}
                value={volume}
                valueLabel="hidden"
              />
              <output
                aria-live="polite"
                className="min-w-12 text-center font-mono text-muted-foreground text-xs tabular-nums"
                id={volumeValueId}
              >
                {Math.round(volume * 100)}%
              </output>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
