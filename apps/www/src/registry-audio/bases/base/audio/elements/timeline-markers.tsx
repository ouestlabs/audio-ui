"use client";

import { isSignature, type SignatureChange } from "@audio-ui/core/time";
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/registry/bases/base/ui/context-menu";

/** A named point of the arrangement, in its time. */
export interface Locator {
  at: number;
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

/**
 * A locator, placed in a `TimelineMark`: press it to put the cursor there,
 * double-click it or press Enter to rename it (Enter keeps the name, Escape
 * drops the change), Delete takes it away.
 */
function TimelineLocator({
  locator,
  onJump,
  onRemove,
  onRename,
}: {
  locator: Locator;
  onJump: (at: number) => void;
  onRemove: (at: number) => void;
  onRename: (at: number, name: string) => void;
}) {
  const { at, name } = locator;
  const [editing, setEditing] = useState(false);
  const handleClick = useCallback(() => onJump(at), [at, onJump]);
  const startEditing = useCallback(() => setEditing(true), []);
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        event.stopPropagation();
        onRemove(at);
      } else if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        setEditing(true);
      }
    },
    [at, onRemove]
  );
  const handleEditKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        const next = event.currentTarget.value.trim();
        if (next) {
          onRename(at, next);
        }
        setEditing(false);
      } else if (event.key === "Escape") {
        setEditing(false);
      }
    },
    [at, onRename]
  );
  const handleBlur = useCallback(() => setEditing(false), []);
  const handleRemove = useCallback(() => onRemove(at), [at, onRemove]);
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
    );
  }
  return (
    <ContextMenu onOpenChangeComplete={handleMenuClosed}>
      <ContextMenuTrigger
        render={
          <button
            aria-label={`Locator ${name}`}
            className="pointer-events-auto flex h-full items-center whitespace-nowrap border-primary border-s-2 ps-1 pe-2 text-primary text-xs outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
            data-slot="timeline-locator"
            onClick={handleClick}
            onDoubleClick={startEditing}
            onKeyDown={handleKeyDown}
            type="button"
          />
        }
      >
        {name}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-auto min-w-32">
        <ContextMenuItem onClick={renameWhenClosed}>Rename</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleRemove} variant="destructive">
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/**
 * A time-signature change, placed in a `TimelineMark`: press it to put the
 * cursor there, double-click it or press Enter to type a new signature such
 * as 7/8 (Enter keeps it, Escape drops it), Left and Right move it by `step`,
 * Delete takes it away. Which change is being typed is held by the host
 * (`editing`), so a change just added can open ready to type.
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
      const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (event.key === "Delete" || event.key === "Backspace") {
        onRemove(id);
      } else if (event.key === "Enter") {
        onEditingChange(id);
      } else if (direction && step > 0) {
        onMove(id, at + direction * step);
      } else {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    [at, id, onEditingChange, onMove, onRemove, step]
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

  if (editing) {
    return (
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
    );
  }
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <button
            aria-label={`Time signature ${label}`}
            className="pointer-events-auto flex h-full items-center whitespace-nowrap border-foreground/60 border-s-2 ps-1 pe-2 text-xs tabular-nums outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
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
  );
}

export { TimelineLocator, TimelineSignature };
