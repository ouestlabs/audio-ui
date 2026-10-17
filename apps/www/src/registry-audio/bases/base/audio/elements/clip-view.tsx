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

/** Whether the clip view is collapsed to its title, and the switch for it. */
const CollapseContext = createContext<{
  collapsed: boolean;
  toggle: () => void;
} | null>(null);

/**
 * A clip's detail view: labelled boxes of its properties beside its editor,
 * side by side when there is room and stacked when not. Put `ClipBox`es in
 * `boxes`, the editor in `children`, and the `ClipTitle` in `title` as well as
 * in the first box: collapsed, from the chevron on the title, the view keeps
 * only that title.
 */
function ClipView({
  boxes,
  children,
  className,
  defaultCollapsed = false,
  collapsed: collapsedProp,
  name,
  onCollapsedChange,
  title,
  ...props
}: Omit<ComponentProps<"section">, "children" | "title"> & {
  boxes: ReactNode;
  children: ReactNode;
  /** Whether it starts collapsed to its title, uncontrolled. @default false */
  defaultCollapsed?: boolean;
  /** Whether it is collapsed to its title, controlled. */
  collapsed?: boolean;
  name: string;
  /** The chevron was pressed. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** The `ClipTitle`, shown alone while the view is collapsed. */
  title: ReactNode;
}) {
  const [ownCollapsed, setOwnCollapsed] = useState(defaultCollapsed);
  const collapsed = collapsedProp ?? ownCollapsed;
  const fold = useMemo(
    () => ({
      collapsed,
      toggle: () => {
        setOwnCollapsed(!collapsed);
        onCollapsedChange?.(!collapsed);
      },
    }),
    [collapsed, onCollapsedChange]
  );
  return (
    <CollapseContext value={fold}>
      <section
        aria-label={`Clip ${name}`}
        className={cn(
          "@container min-w-0 shrink-0 overflow-hidden rounded-xl border bg-card text-xs",
          className
        )}
        data-collapsed={collapsed ? "" : undefined}
        data-slot="clip-view"
        {...props}
      >
        {collapsed ? (
          <div className="w-44 p-2" data-slot="clip-view-bar">
            {title}
          </div>
        ) : (
          <ClipViewBody boxes={boxes}>{children}</ClipViewBody>
        )}
      </section>
    </CollapseContext>
  );
}

/** The boxes and the editor of an open clip view. */
function ClipViewBody({
  boxes,
  children,
}: {
  boxes: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col @3xl:flex-row">
      <div
        className="flex shrink-0 divide-x overflow-x-auto border-b @3xl:border-e @3xl:border-b-0"
        data-slot="clip-view-boxes"
      >
        {boxes}
      </div>
      <div
        className="flex min-w-0 flex-1 flex-col"
        data-slot="clip-view-editor"
      >
        {children}
      </div>
    </div>
  );
}

/** One labelled box of a clip's properties, as a DAW's clip view groups them. */
function ClipBox({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <fieldset
      className={cn("flex w-44 shrink-0 flex-col gap-1.5 p-2", className)}
      data-slot="clip-box"
    >
      <legend className="float-left mb-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

/** The clip's name with its switch: off, the clip stays on its track and is not heard. */
function ClipTitle({
  active,
  children,
  name,
  onActiveChange,
}: {
  active?: boolean;
  /** At the end of the row, such as a close button. */
  children?: ReactNode;
  name: string;
  onActiveChange?: (active: boolean) => void;
}) {
  const toggle = useCallback(
    () => onActiveChange?.(!active),
    [active, onActiveChange]
  );
  const fold = use(CollapseContext);
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {fold ? (
        <button
          aria-expanded={!fold.collapsed}
          aria-label={
            fold.collapsed ? "Expand the clip view" : "Collapse the clip view"
          }
          className="-ms-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none transition-transform hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-expanded:rotate-90"
          onClick={fold.toggle}
          type="button"
        >
          <svg
            aria-hidden="true"
            className="size-3"
            fill="currentColor"
            viewBox="0 0 12 12"
          >
            <path d="M4 2.5 8.5 6 4 9.5z" />
          </svg>
        </button>
      ) : null}
      {onActiveChange ? (
        <button
          aria-label={active ? "Switch the clip off" : "Switch the clip on"}
          aria-pressed={active}
          className="size-3 shrink-0 rounded-[2px] border border-primary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-primary"
          onClick={toggle}
          type="button"
        />
      ) : null}
      <h3 className="min-w-0 flex-1 truncate font-medium text-sm">{name}</h3>
      {children}
    </div>
  );
}

/** A row of a box: a label, and its field or toggles. */
function ClipRow({
  children,
  htmlFor,
  label,
}: {
  children: ReactNode;
  htmlFor?: string;
  label: string;
}) {
  return (
    <div className="grid grid-cols-[4rem_1fr] items-center gap-1.5">
      <label className="truncate text-muted-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

/** A switch of a box, small and labelled: filled while on. */
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

const FIELD =
  "h-6 w-full min-w-0 rounded-md border bg-background px-1.5 text-end text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

/**
 * A text field for a value shown as `format` gives it and read back with
 * `parse`: Enter or leaving it sets what was typed, Escape gives it up, and
 * Up and Down step it by `step` (ten times with Shift). Each set commits.
 */
function ClipField({
  disabled,
  format,
  id,
  label,
  onChange,
  onCommit,
  parse,
  step,
  value,
}: {
  disabled?: boolean;
  format: (value: number) => string;
  id?: string;
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
      className={FIELD}
      disabled={disabled}
      id={id}
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

export {
  ClipBox,
  ClipField,
  ClipRow,
  ClipTitle,
  ClipToggle,
  ClipView,
  PositionField,
};
