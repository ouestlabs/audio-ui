import {
  barLabelInterval,
  barsOf,
  isSignature,
  type SignatureChange,
  secondsPerBar,
  type Tempo,
} from "@audio-ui/engine/time";
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { TimelineMark } from "@/components/audio-ui/timeline";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

/** A named point of the arrangement, in its time. */
export interface Locator {
  at: number;
  /** Stays the same as it moves, so its button keeps the focus. */
  id: string;
  name: string;
}

/** A time-signature change, with an id that stays the same as it moves, so its button keeps the focus. */
export type Signature = SignatureChange & { id: string };

/** "7/8" as a signature, or null when it is not one a bar can have. */
export function parseSignature(text: string) {
  const [beats, unit] = text.split("/").map((part) => Number(part.trim()));
  return beats !== undefined && unit !== undefined && isSignature(beats, unit)
    ? { beatUnit: unit, beatsPerBar: beats }
    : null;
}

/** Keeps a press inside a field from reaching the lane under it. */
function stopPress(event: PointerEvent<HTMLElement>) {
  event.stopPropagation();
}

/** A mark for a marker: no tick or padding of a mark's own, so the marker's own line stands on its time. */
const ON_ITS_TIME = "border-s-0 ps-0";

/**
 * A locator, on its time on a lane: press it to put the cursor there,
 * double-click it to play from there, drag it or press Left and Right to move
 * it, on the grid, press Enter or pick Rename in its menu to rename it (Enter
 * keeps the name, Escape drops the change), Delete takes it away. With
 * `onLoopToNext`, its menu loops from it to the next locator.
 */
function TimelineLocator({
  locator,
  onJump,
  onLoopToNext,
  onMove,
  onPlay,
  onRemove,
  onRename,
  step,
}: {
  locator: Locator;
  onJump: (at: number) => void;
  /** Its menu's "Loop to the next locator": the loop from it to the next one, or to the end. */
  onLoopToNext?: (id: string) => void;
  onMove: (id: string, to: number) => void;
  /** A double-click on it: play from its time. */
  onPlay: (at: number) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  /** How far the arrows move it, in the timeline's units. */
  step: number;
}) {
  const { at, id, name } = locator;
  const [editing, setEditing] = useState(false);
  const handleClick = useCallback(() => onJump(at), [at, onJump]);
  const handleDoubleClick = useCallback(() => onPlay(at), [at, onPlay]);
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        event.stopPropagation();
        onRemove(id);
      } else if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        setEditing(true);
      }
    },
    [id, onRemove]
  );
  const handleEditKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        const next = event.currentTarget.value.trim();
        if (next) {
          onRename(id, next);
        }
        setEditing(false);
      } else if (event.key === "Escape") {
        setEditing(false);
      }
    },
    [id, onRename]
  );
  const handleBlur = useCallback(() => setEditing(false), []);
  const handleRemove = useCallback(() => onRemove(id), [id, onRemove]);
  const handleLoop = useCallback(() => onLoopToNext?.(id), [id, onLoopToNext]);
  const handleMoved = useCallback((to: number) => onMove(id, to), [id, onMove]);
  // The menu hands focus back as it closes, which would end the edit: open the field after it.
  const renameLater = useRef(false);
  const renameWhenClosed = useCallback(() => {
    renameLater.current = true;
  }, []);
  const handleMenuClosed = useCallback((open: boolean) => {
    if (!open && renameLater.current) {
      renameLater.current = false;
      setEditing(true);
    }
  }, []);

  if (editing) {
    return (
      <TimelineMark className={ON_ITS_TIME} value={at}>
        <input
          aria-label="Locator name"
          autoFocus
          className="h-full w-24 border-primary border-s-2 bg-background px-1 text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-slot="timeline-locator-input"
          defaultValue={name}
          onBlur={handleBlur}
          onKeyDown={handleEditKeyDown}
          onPointerDown={stopPress}
        />
      </TimelineMark>
    );
  }
  return (
    <TimelineMark
      className={ON_ITS_TIME}
      onValueCommitted={handleMoved}
      step={step}
      value={at}
    >
      <ContextMenu onOpenChangeComplete={handleMenuClosed}>
        <ContextMenuTrigger
          render={
            <button
              aria-label={`Locator ${name}`}
              className="pointer-events-auto flex h-full cursor-grab touch-none items-center whitespace-nowrap border-primary border-s-2 ps-1 pe-2 text-primary text-xs outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
              data-slot="timeline-locator"
              onClick={handleClick}
              onDoubleClick={handleDoubleClick}
              onKeyDown={handleKeyDown}
              type="button"
            />
          }
        >
          {name}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-auto min-w-32">
          {onLoopToNext ? (
            <ContextMenuItem onClick={handleLoop}>
              Loop to the next locator
            </ContextMenuItem>
          ) : null}
          <ContextMenuItem onClick={renameWhenClosed}>Rename</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleRemove} variant="destructive">
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </TimelineMark>
  );
}

/**
 * A time-signature change, on its time on a lane: press it to put the
 * cursor there, drag it or press Left and Right to move it, on the grid,
 * double-click it or press Enter to type a new signature such as 7/8 (Enter
 * keeps it, Escape drops it), Delete takes it away. Which change is being
 * typed is held by the host (`editing`), so a change just added can open ready
 * to type.
 */
function TimelineSignature({
  change,
  editing,
  onEditingChange,
  onJump,
  onMove,
  onRemove,
  onSet,
  step,
}: {
  change: Signature;
  editing: boolean;
  onEditingChange: (id: string | null) => void;
  onJump: (at: number) => void;
  onMove: (id: string, to: number) => void;
  onRemove: (id: string) => void;
  onSet: (id: string, beatsPerBar: number, beatUnit: number) => void;
  step: number;
}) {
  const { at, beatUnit, beatsPerBar, id } = change;
  const label = `${beatsPerBar}/${beatUnit}`;
  const handleClick = useCallback(() => onJump(at), [at, onJump]);
  const startEditing = useCallback(
    () => onEditingChange(id),
    [id, onEditingChange]
  );
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        onRemove(id);
      } else if (event.key === "Enter") {
        onEditingChange(id);
      } else {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    [id, onEditingChange, onRemove]
  );
  const handleEditKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        const parsed = parseSignature(event.currentTarget.value);
        if (parsed) {
          onSet(id, parsed.beatsPerBar, parsed.beatUnit);
        }
        onEditingChange(null);
      } else if (event.key === "Escape") {
        onEditingChange(null);
      }
    },
    [id, onEditingChange, onSet]
  );
  const stopEditing = useCallback(
    () => onEditingChange(null),
    [onEditingChange]
  );
  const handleRemove = useCallback(() => onRemove(id), [id, onRemove]);
  const handleMoved = useCallback((to: number) => onMove(id, to), [id, onMove]);

  if (editing) {
    return (
      <TimelineMark className={ON_ITS_TIME} value={at}>
        <input
          aria-label="Time signature, such as 7/8"
          autoFocus
          className="h-full w-14 border-primary border-s-2 bg-background px-1 text-primary text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-slot="timeline-signature-input"
          defaultValue={label}
          onBlur={stopEditing}
          onKeyDown={handleEditKeyDown}
          onPointerDown={stopPress}
        />
      </TimelineMark>
    );
  }
  return (
    <TimelineMark
      className={ON_ITS_TIME}
      onValueCommitted={handleMoved}
      step={step}
      value={at}
    >
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <button
              aria-label={`Time signature ${label}`}
              className="pointer-events-auto flex h-full cursor-grab touch-none items-center whitespace-nowrap border-foreground/60 border-s-2 ps-1 pe-2 text-xs tabular-nums outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
              data-slot="timeline-signature"
              onClick={handleClick}
              onDoubleClick={startEditing}
              onKeyDown={handleKeyDown}
              type="button"
            />
          }
        >
          {label}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-auto min-w-32">
          <ContextMenuItem onClick={startEditing}>Edit</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleRemove} variant="destructive">
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </TimelineMark>
  );
}

/**
 * The bars of a ruler, through the time-signature changes: their numbers, every
 * few bars so they never crowd at this zoom, and the bars a change cuts short,
 * hatched. Put it inside a `TimelineRuler`.
 */
function TimelineBarMarks({
  duration,
  signatures,
  tempo,
  zoom,
}: {
  /** The arrangement's length, in seconds. */
  duration: number;
  signatures: readonly SignatureChange[];
  tempo: Tempo;
  /** The timeline's zoom, in px per second. */
  zoom: number;
}) {
  const bars = useMemo(
    () => barsOf(tempo, signatures, duration),
    [duration, signatures, tempo]
  );
  // Whole bars, counted rather than divided, so no tempo leaves a label like 6.9999.
  const every = Math.max(
    1,
    Math.round(barLabelInterval(zoom, tempo) / secondsPerBar(tempo))
  );
  return (
    <>
      {bars
        .filter((item) => item.partial)
        .map((item) => (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 bg-[repeating-linear-gradient(135deg,var(--muted-foreground)_0_1px,transparent_1px_6px)] opacity-30"
            data-slot="timeline-partial-bar"
            key={item.start}
            style={{
              left: `calc(var(--timeline-unit) * ${item.start})`,
              width: `calc(var(--timeline-unit) * ${item.length})`,
            }}
          />
        ))}
      {bars
        .filter((_, index) => index % every === 0)
        .map((item) => (
          <TimelineMark key={item.start} value={item.start}>
            {item.number}
          </TimelineMark>
        ))}
    </>
  );
}

export { TimelineBarMarks, TimelineLocator, TimelineSignature };
