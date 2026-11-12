import type { Source } from "@audio-ui/react";
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
  useSyncExternalStore,
} from "react";
import { ParameterField } from "@/components/audio-ui/parameter-field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      {/* The view's own edge: it rolls up from here, and rolled up it is all that stays. A press anywhere on it
          outside its controls rolls the view up or opens it: the caret reaches across it, under the controls. */}
      <div
        className={cn(
          "relative flex min-h-10 shrink-0 items-center gap-2 p-1 ps-2",
          collapsed ? undefined : "border-b"
        )}
        data-slot="clip-view-strip"
      >
        <button
          aria-expanded={!collapsed}
          aria-label={
            collapsed ? "Open the clip view" : "Roll the clip view up"
          }
          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring after:absolute after:inset-0 hover:after:bg-muted/40"
          onClick={toggleCollapsed}
          type="button"
        >
          <Caret className={collapsed ? "-rotate-90" : undefined} />
        </button>
        {onActiveChange ? (
          <button
            aria-label={active ? "Switch the clip off" : "Switch the clip on"}
            aria-pressed={active}
            className="relative z-10 size-3 shrink-0 rounded-[2px] border border-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-primary aria-pressed:bg-primary"
            onClick={toggleActive}
            title="Take the clip out of the arrangement, or put it back"
            type="button"
          />
        ) : null}
        <ClipNameField name={name} onRename={onRename} />
        <div className="pointer-events-none relative flex min-w-0 flex-1 items-center gap-3 overflow-hidden text-muted-foreground tabular-nums">
          {status}
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-2 empty:hidden">
          {actions}
        </div>
      </div>
      {/* Given a height, the boxes and the editor reach the bottom of it. */}
      {collapsed ? null : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col @3xl:flex-row">
          <BoxesContext value={boxContext}>
            <div
              className="flex shrink-0 overflow-x-auto border-b @3xl:border-e @3xl:border-b-0"
              data-slot="clip-view-boxes"
            >
              {boxes}
            </div>
          </BoxesContext>
          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col"
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
 * beside it never move under the pointer. With `foldable`, a press on its
 * heading folds it to a narrow strip that keeps its name and the caret, and
 * gives its width to the editor; a press anywhere on the strip unfolds it.
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
      className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground outline-none after:absolute after:inset-0 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
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
        className="relative flex w-6 shrink-0 flex-col items-center gap-2 border-s py-2 first:border-s-0 hover:bg-muted/50"
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
      <div
        className={cn("flex h-5 items-center gap-1.5", foldable && "relative")}
      >
        <h4 className="truncate font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </h4>
        <span className="ms-auto">{caret}</span>
      </div>
      {children}
    </section>
  );
}

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
      className="relative z-10 h-6 w-40 min-w-0 rounded-md border border-transparent bg-transparent px-1.5 font-medium text-sm outline-none hover:border-border focus-visible:border-border focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring read-only:hover:border-transparent"
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
 * A time field in bars.beats.sixteenths, as a parameter field: a position
 * from 1.1.1, or a length from 0.0.0. The arrows step a sixteenth, a beat
 * with Shift; a drag on its label scrubs it.
 */
function PositionField({
  disabled,
  kind = "position",
  label,
  max = Number.POSITIVE_INFINITY,
  meter,
  min = 0,
  onChange,
  onCommit,
  shortLabel,
  value,
}: {
  disabled?: boolean;
  kind?: "length" | "position";
  /** Names the field for assistive technology. */
  label: string;
  max?: number;
  meter: ClipMeter;
  min?: number;
  onChange: (seconds: number) => void;
  onCommit?: () => void;
  /** What the field shows at its start; without it, the label is kept out of sight. */
  shortLabel?: string;
  value: number;
}) {
  const format = useCallback(
    (seconds: number) => formatBars(seconds, meter, kind),
    [kind, meter]
  );
  const parse = useCallback(
    (text: string) => parseBars(text, meter, kind),
    [kind, meter]
  );
  const sixteenth = sixteenthOf(meter);
  return (
    <ParameterField
      disabled={disabled}
      formatValue={format}
      hideLabel={shortLabel === undefined}
      label={label}
      largeStep={sixteenth * 4}
      max={max}
      min={min}
      onValueChange={onChange}
      onValueCommitted={onCommit}
      parseValue={parse}
      shortLabel={shortLabel}
      size="sm"
      step={sixteenth}
      value={value}
    />
  );
}

/** What a clip's playhead reads while the clip does not play: nothing to show. */
const NOT_PLAYING = -1;
const noSubscription = () => () => undefined;

/**
 * Where playback reads a clip's source, live, from the arrangement's
 * `position`: in the source's time, from where the clip starts in it and
 * round its loop, or `NOT_PLAYING` outside the clip. `playing` says whether
 * the clip plays now, and changes only when that does, not each frame.
 */
function useClipPlayhead(
  position: Source<number> | undefined,
  {
    length,
    loop,
    offset,
    start,
  }: {
    length: number;
    loop: readonly [number, number] | null | undefined;
    offset: number;
    /** Where the clip starts on the arrangement. */
    start: number;
  }
) {
  const playhead = useMemo<Source<number> | undefined>(() => {
    if (!position) {
      return;
    }
    const read = (at: number) => {
      const into = at - start;
      if (into < 0 || into >= length) {
        return NOT_PLAYING;
      }
      const time = offset + into;
      if (!loop || time < loop[1] || loop[1] <= loop[0]) {
        return time;
      }
      return loop[0] + ((time - loop[0]) % (loop[1] - loop[0]));
    };
    return {
      getSnapshot: () => read(position.getSnapshot()),
      subscribe: position.subscribe,
    };
  }, [length, loop, offset, position, start]);
  const playing = useSyncExternalStore(
    playhead?.subscribe ?? noSubscription,
    () => (playhead ? playhead.getSnapshot() !== NOT_PLAYING : false),
    () => false
  );
  return { playhead, playing };
}

export {
  ClipBox,
  ClipRow,
  ClipToggle,
  ClipView,
  NOT_PLAYING,
  PositionField,
  useClipPlayhead,
};
