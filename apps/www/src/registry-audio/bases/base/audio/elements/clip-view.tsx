"use client";

import {
  type ChangeEvent,
  type ComponentProps,
  createContext,
  type KeyboardEvent,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";

/** Where bars and beats fall, in seconds: what position fields count in. */
export interface ClipMeter {
  /** How long a bar lasts, in seconds. */
  bar: number;
  /** Beats in a bar. */
  beatsPerBar: number;
}

/** What may stand between bars, beats and sixteenths when one is typed. */
const SEPARATORS = /[.:\s]+/;

/** A sixteenth of a beat's quarter: positions are counted to it. */
const sixteenthOf = ({ bar, beatsPerBar }: ClipMeter) => bar / beatsPerBar / 4;

/** Seconds as bars, beats and sixteenths: from 1.1.1 for a position, from 0.0.0 for a length. */
export function formatBars(
  seconds: number,
  meter: ClipMeter,
  kind: "length" | "position" = "position"
): string {
  const sixteenth = sixteenthOf(meter);
  const total = Math.round(Math.max(0, seconds) / sixteenth);
  const perBar = meter.beatsPerBar * 4;
  const one = kind === "position" ? 1 : 0;
  const bars = Math.floor(total / perBar) + one;
  const beats = Math.floor((total % perBar) / 4) + one;
  const sixteenths = (total % 4) + one;
  return `${bars}.${beats}.${sixteenths}`;
}

/** The seconds a bars.beats.sixteenths text stands for, or null when it is not one. */
export function parseBars(
  text: string,
  meter: ClipMeter,
  kind: "length" | "position" = "position"
): number | null {
  const parts = text.trim().split(SEPARATORS).map(Number);
  if (parts.length === 0 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  const one = kind === "position" ? 1 : 0;
  const [bars = one, beats = one, sixteenths = one] = parts;
  const sixteenth = sixteenthOf(meter);
  return (
    ((bars - one) * meter.beatsPerBar * 4 +
      (beats - one) * 4 +
      (sixteenths - one)) *
    sixteenth
  );
}

/** Which boxes are folded, and the switch for one: what a `ClipBox` with `foldable` reads. */
const BoxesContext = createContext<{
  folded: readonly string[];
  toggle: (id: string) => void;
} | null>(null);

/** A small filled triangle, pointing down unless turned. */
function Caret({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("size-3 shrink-0", className)}
      fill="currentColor"
      viewBox="0 0 12 12"
    >
      <path d="M2.5 4h7L6 8.5z" />
    </svg>
  );
}

/**
 * A clip's detail view, as a DAW's: a strip along its top with the caret that
 * rolls the view up to that strip, the clip's switch and name, then boxes of
 * its properties beside its editor. Rolled up, the strip still says which
 * clip is open and opens it again. Put `ClipBox`es in `boxes` (the others
 * than the first with `foldable`, which fold to a strip and give their width
 * to the editor), the editor in `children`, and controls for the strip's end,
 * such as a close button, in `actions`.
 */
function ClipView({
  actions,
  active,
  boxes,
  children,
  className,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  foldedBoxes: foldedProp,
  name,
  onActiveChange,
  onCollapsedChange,
  onFoldedBoxesChange,
  onRename,
  status,
  ...props
}: Omit<ComponentProps<"section">, "children"> & {
  /** At the end of the strip, such as a close button. */
  actions?: ReactNode;
  /** Whether the clip is on. Leave it out, with `onActiveChange`, for a view without the switch. */
  active?: boolean;
  boxes: ReactNode;
  children: ReactNode;
  /** Whether it is rolled up to its strip, controlled. */
  collapsed?: boolean;
  /** Whether it starts rolled up, uncontrolled. @default false */
  defaultCollapsed?: boolean;
  /** The ids of the folded boxes, controlled: keep them outside to hold them from clip to clip. */
  foldedBoxes?: readonly string[];
  name: string;
  onActiveChange?: (active: boolean) => void;
  /** The caret was pressed. */
  onCollapsedChange?: (collapsed: boolean) => void;
  onFoldedBoxesChange?: (folded: string[]) => void;
  /** A name was typed in the strip. Leave it out for a name that only reads. */
  onRename?: (name: string) => void;
  /** What the strip says after the name, such as the notes selected or the clip's length. */
  status?: ReactNode;
}) {
  const [ownCollapsed, setOwnCollapsed] = useState(defaultCollapsed);
  const collapsed = collapsedProp ?? ownCollapsed;
  const toggleCollapsed = useCallback(() => {
    setOwnCollapsed(!collapsed);
    onCollapsedChange?.(!collapsed);
  }, [collapsed, onCollapsedChange]);
  const toggleActive = useCallback(
    () => onActiveChange?.(!active),
    [active, onActiveChange]
  );
  const [ownFolded, setOwnFolded] = useState<readonly string[]>([]);
  const folded = foldedProp ?? ownFolded;
  const boxContext = useMemo(
    () => ({
      folded,
      toggle: (id: string) => {
        const next = folded.includes(id)
          ? folded.filter((other) => other !== id)
          : [...folded, id];
        setOwnFolded(next);
        onFoldedBoxesChange?.(next);
      },
    }),
    [folded, onFoldedBoxesChange]
  );
  return (
    <section
      aria-label={`Clip ${name}`}
      className={cn(
        "@container flex min-w-0 shrink-0 flex-col overflow-hidden rounded-xl border bg-card text-xs",
        className
      )}
      data-collapsed={collapsed ? "" : undefined}
      data-slot="clip-view"
      {...props}
    >
      {/* The view's own edge: it rolls up from here, and rolled up it is all that stays. */}
      <div
        className={cn(
          "flex min-h-9 shrink-0 items-center gap-2 p-1 ps-2",
          collapsed ? undefined : "border-b"
        )}
        data-slot="clip-view-strip"
      >
        <button
          aria-expanded={!collapsed}
          aria-label={
            collapsed ? "Open the clip view" : "Roll the clip view up"
          }
          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onClick={toggleCollapsed}
          type="button"
        >
          <Caret className={collapsed ? "-rotate-90" : undefined} />
        </button>
        {onActiveChange ? (
          <button
            aria-label={active ? "Switch the clip off" : "Switch the clip on"}
            aria-pressed={active}
            className="size-3 shrink-0 rounded-[2px] border border-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-primary aria-pressed:bg-primary"
            onClick={toggleActive}
            title="Take the clip out of the arrangement, or put it back"
            type="button"
          />
        ) : null}
        <ClipNameField name={name} onRename={onRename} />
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden text-muted-foreground tabular-nums">
          {status}
        </div>
        {actions}
      </div>
      {collapsed ? null : (
        <div className="flex min-h-0 min-w-0 flex-col @3xl:flex-row">
          <BoxesContext value={boxContext}>
            <div
              className="flex shrink-0 overflow-x-auto border-b @3xl:border-e @3xl:border-b-0"
              data-slot="clip-view-boxes"
            >
              {boxes}
            </div>
          </BoxesContext>
          <div
            className="flex min-w-0 flex-1 flex-col"
            data-slot="clip-view-editor"
          >
            {children}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * One box of a clip's properties, a column of a fixed width so the boxes
 * beside it never move under the pointer. With `foldable`, a caret in its
 * heading folds it to a narrow strip that keeps its name and the caret, and
 * gives its width to the editor.
 */
function ClipBox({
  children,
  className,
  foldable,
  id,
  title,
}: {
  children: ReactNode;
  className?: string;
  /** Whether it folds to a strip from its heading. */
  foldable?: boolean;
  /** Its id among the folded boxes: what keeps it folded from clip to clip. @default title */
  id?: string;
  title: string;
}) {
  const boxes = use(BoxesContext);
  const key = id ?? title;
  const folded = Boolean(foldable && boxes?.folded.includes(key));
  const toggle = useCallback(() => boxes?.toggle(key), [boxes, key]);
  const caret = foldable ? (
    <button
      aria-expanded={!folded}
      aria-label={folded ? `Unfold ${title}` : `Fold ${title}`}
      className="flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      onClick={toggle}
      type="button"
    >
      <Caret className={folded ? "-rotate-90" : "rotate-90"} />
    </button>
  ) : null;
  if (folded) {
    return (
      <section
        aria-label={title}
        className="flex w-6 shrink-0 flex-col items-center gap-2 border-s py-2 first:border-s-0"
        data-folded=""
        data-slot="clip-box"
      >
        {caret}
        <h4 className="font-semibold text-muted-foreground uppercase tracking-wide [writing-mode:vertical-rl]">
          {title}
        </h4>
      </section>
    );
  }
  return (
    <section
      aria-label={title}
      className={cn(
        "flex w-40 shrink-0 flex-col gap-1.5 border-s p-2 first:border-s-0",
        className
      )}
      data-slot="clip-box"
    >
      <div className="flex h-5 items-center gap-1.5">
        <h4 className="truncate font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </h4>
        <span className="ms-auto">{caret}</span>
      </div>
      {children}
    </section>
  );
}

const FIELD =
  "h-6 w-full min-w-0 rounded-md border bg-background px-1.5 text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

/** The clip's name, editable in place: Enter or leaving the field renames it, Escape gives it up. */
function ClipNameField({
  name,
  onRename,
}: {
  name: string;
  onRename?: (name: string) => void;
}) {
  const [text, setText] = useState(name);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) {
      setText(name);
    }
  }, [editing, name]);
  const commit = useCallback(() => {
    setEditing(false);
    if (text.trim() && text !== name) {
      onRename?.(text.trim());
    } else {
      setText(name);
    }
  }, [name, onRename, text]);
  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setEditing(true);
    setText(event.target.value);
  }, []);
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.currentTarget.blur();
      } else if (event.key === "Escape") {
        setText(name);
        setEditing(false);
        event.currentTarget.blur();
      }
    },
    [name]
  );
  return (
    <input
      aria-label="Clip name"
      className="h-6 w-40 min-w-0 rounded-md border border-transparent bg-transparent px-1.5 font-medium text-sm outline-none hover:border-border focus-visible:border-border focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring read-only:hover:border-transparent"
      onBlur={commit}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      readOnly={!onRename}
      spellCheck={false}
      type="text"
      value={text}
    />
  );
}

/** A row of a box: a label, and its field. */
function ClipRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="grid grid-cols-[3.25rem_1fr] items-center gap-1">
      <span aria-hidden="true" className="truncate text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

/** A switch or an operation of a box, small: filled while `pressed`. */
function ClipToggle({
  children,
  className,
  pressed,
  ...props
}: Omit<ComponentProps<typeof Button>, "size" | "variant"> & {
  pressed?: boolean;
}) {
  return (
    <Button
      aria-pressed={pressed}
      className={cn("h-6 px-2 text-xs", className)}
      size="xs"
      variant={pressed ? "default" : "outline"}
      {...props}
    >
      {children}
    </Button>
  );
}

/**
 * A text field for a value shown as `format` gives it and read back with
 * `parse`: Enter or leaving it sets what was typed, Escape gives it up, and
 * Up and Down step it by `step` (ten times with Shift). Each set commits.
 */
function ClipField({
  disabled,
  format,
  label,
  onChange,
  onCommit,
  parse,
  step,
  value,
}: {
  disabled?: boolean;
  format: (value: number) => string;
  label: string;
  onChange: (value: number) => void;
  onCommit?: () => void;
  parse: (text: string) => number | null;
  step: number;
  value: number;
}) {
  const [text, setText] = useState(() => format(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) {
      setText(format(value));
    }
  }, [editing, format, value]);
  const apply = useCallback(
    (next: number | null) => {
      if (next !== null && Number.isFinite(next)) {
        onChange(next);
        onCommit?.();
      }
    },
    [onChange, onCommit]
  );
  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setEditing(true);
    setText(event.target.value);
  }, []);
  const handleBlur = useCallback(() => {
    if (editing) {
      apply(parse(text));
      setEditing(false);
    }
  }, [apply, editing, parse, text]);
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      const direction = { ArrowDown: -1, ArrowUp: 1 }[event.key];
      if (direction) {
        event.preventDefault();
        apply(value + direction * step * (event.shiftKey ? 10 : 1));
        setEditing(false);
      } else if (event.key === "Enter") {
        event.preventDefault();
        apply(parse(text));
        setEditing(false);
      } else if (event.key === "Escape") {
        setText(format(value));
        setEditing(false);
      }
    },
    [apply, format, parse, step, text, value]
  );
  return (
    <input
      aria-label={label}
      className={cn(FIELD, "text-end")}
      disabled={disabled}
      onBlur={handleBlur}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      spellCheck={false}
      type="text"
      value={text}
    />
  );
}

/** A time field in bars.beats.sixteenths: a position from 1.1.1, or a length from 0.0.0. Up and Down step a sixteenth, ten with Shift. */
function PositionField({
  kind = "position",
  max = Number.POSITIVE_INFINITY,
  meter,
  min = 0,
  onChange,
  ...props
}: Omit<
  ComponentProps<typeof ClipField>,
  "format" | "parse" | "step" | "onChange"
> & {
  kind?: "length" | "position";
  max?: number;
  meter: ClipMeter;
  min?: number;
  onChange: (seconds: number) => void;
}) {
  const format = useCallback(
    (seconds: number) => formatBars(seconds, meter, kind),
    [kind, meter]
  );
  const parse = useCallback(
    (text: string) => parseBars(text, meter, kind),
    [kind, meter]
  );
  const change = useCallback(
    (seconds: number) => onChange(Math.min(max, Math.max(min, seconds))),
    [max, min, onChange]
  );
  return (
    <ClipField
      format={format}
      onChange={change}
      parse={parse}
      step={sixteenthOf(meter)}
      {...props}
    />
  );
}

export { ClipBox, ClipField, ClipRow, ClipToggle, ClipView, PositionField };
