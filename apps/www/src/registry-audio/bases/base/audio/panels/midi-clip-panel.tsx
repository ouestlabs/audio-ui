"use client";

import type { Note } from "@audio-ui/core/piano-roll";
import type { PianoRoll as PianoRollPrimitive } from "@audio-ui/react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
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
  TimelineMark,
  TimelineNavigator,
  TimelineRuler,
} from "@/registry-audio/bases/base/audio/elements/timeline";

/** C1 to C7: the range a clip's notes can take, scrolled to where they are. */
const MIN_PITCH = 24;
const MAX_PITCH = 96;
/** The roll's height, fixed whatever stretches the rolls around it. */
const ROLL_SIZE = { flex: "none", height: "18rem" } as const;
/** The widest a sixteenth gets, in px. */
const MAX_STEP_PX = 64;

interface MidiClipPanelProps {
  /** How long a bar lasts, in seconds: the ruler numbers each. */
  bar: number;
  /** How long a beat lasts, in seconds: a firmer grid line marks each. */
  beat: number;
  /** Controls beside the name, such as a close button. */
  children?: ReactNode;
  className?: string;
  /** How long the clip's source is, in seconds: the roll is that long. */
  length: number;
  name: string;
  /** The clip's notes, in seconds from the start of its source. */
  notes: readonly Note[];
  /** Fires when a pitch stops sounding. */
  onNoteOff?: PianoRollPrimitive.Root.Props["onNoteOff"];
  /** Fires when a key is pressed or a note drawn: sound it. */
  onNoteOn?: PianoRollPrimitive.Root.Props["onNoteOn"];
  /** Fires on every change of the notes, as a drag goes. */
  onNotesChange: (notes: Note[]) => void;
  /** Fires once a change ends: the place to take an undo step. */
  onNotesCommitted?: () => void;
  /** The grid notes are drawn and moved on, in seconds. @default a quarter of `beat` */
  step?: number;
}

/**
 * The clip view of a MIDI clip: its notes on a piano roll of their own (an
 * overview, a bar ruler, the keys, the grid and a velocity lane), beside its
 * name and the switches that change how the roll draws and shows them.
 * Drawing paints a note a grid step at a time; the notes are in seconds, from
 * the start of the clip's source. Key it by the clip, so it opens on each
 * clip's notes.
 */
function MidiClipPanel({
  bar,
  beat,
  children,
  className,
  length,
  name,
  notes,
  onNoteOff,
  onNoteOn,
  onNotesChange,
  onNotesCommitted,
  step = beat / 4,
}: MidiClipPanelProps) {
  const [drawing, setDrawing] = useState(true);
  const [folded, setFolded] = useState(false);
  const toggleDrawing = useCallback(() => setDrawing((on) => !on), []);
  const toggleFolded = useCallback(() => setFolded((on) => !on), []);
  const value = useMemo(() => [...notes], [notes]);
  const bars = useMemo(
    () =>
      Array.from(
        { length: Math.ceil(length / bar) },
        (_, index) => index * bar
      ),
    [bar, length]
  );

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
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const row = (MAX_PITCH - centerRef.current) / (MAX_PITCH - MIN_PITCH + 1);
    viewport.scrollTop =
      row * viewport.scrollHeight - viewport.clientHeight / 2;
  }, []);

  return (
    <section
      aria-label={`Clip ${name}`}
      className={cn(
        "@container min-w-0 shrink-0 overflow-hidden rounded-xl border bg-card",
        className
      )}
      data-slot="midi-clip-panel"
    >
      <div className="flex min-w-0 flex-col @2xl:flex-row">
        {/* The clip's properties, as a DAW's clip view lists them beside its editor. */}
        <div className="flex shrink-0 flex-col gap-3 border-b p-3 @2xl:w-56 @2xl:border-e @2xl:border-b-0">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate font-medium text-sm">
              {name}
            </h3>
            {children}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              aria-pressed={drawing}
              onClick={toggleDrawing}
              size="sm"
              variant={drawing ? "default" : "outline"}
            >
              <IconPlaceholder
                aria-hidden="true"
                className="size-4"
                hugeicons="PencilEdit01Icon"
                lucide="PencilIcon"
                phosphor="PencilSimpleIcon"
                remixicon="RiPencilLine"
                tabler="IconPencil"
              />
              Draw
            </Button>
            <Button
              aria-pressed={folded}
              onClick={toggleFolded}
              size="sm"
              variant={folded ? "default" : "outline"}
            >
              <IconPlaceholder
                aria-hidden="true"
                className="size-4"
                hugeicons="ArrowShrink02Icon"
                lucide="FoldVerticalIcon"
                phosphor="ArrowsInLineVerticalIcon"
                remixicon="RiContractUpDownLine"
                tabler="IconFoldDown"
              />
              Fold
            </Button>
          </div>
          <p className="text-muted-foreground text-xs tabular-nums">
            {notes.length === 1 ? "1 note" : `${notes.length} notes`}
          </p>
        </div>
        <Timeline
          className="min-w-0 flex-1"
          duration={length}
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
            onValueChange={onNotesChange}
            onValueCommitted={onNotesCommitted}
            // Its own height, inline: a page that stretches the rolls it shows to fill it leaves this one be.
            style={ROLL_SIZE}
            value={value}
          >
            <PianoRollStrip className="border-b">
              <TimelineNavigator className="mx-2 my-1.5" />
            </PianoRollStrip>
            <PianoRollViewport ref={viewportRef}>
              <PianoRollStrip className="border-b" sticky="top">
                <TimelineRuler
                  aria-label="Position in the clip"
                  className="h-5 border-b-0 text-[10px]"
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
                lead={<PianoRollVelocityScale />}
                sticky="bottom"
              >
                <PianoRollVelocity accentStep={beat} gridStep={step} />
              </PianoRollStrip>
            </PianoRollViewport>
          </PianoRoll>
        </Timeline>
      </div>
    </section>
  );
}

export { MidiClipPanel, type MidiClipPanelProps };
