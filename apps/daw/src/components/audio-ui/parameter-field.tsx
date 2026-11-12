import { NumberField } from "@base-ui/react/number-field";
import {
  ArrowsHorizontalIcon,
  MinusIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import { cva } from "class-variance-authority";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

const parameterFieldVariants = cva("w-auto min-w-0", {
  defaultVariants: { size: "default" },
  variants: {
    size: {
      default: "",
      sm: "h-7 text-xs [&_input]:text-xs",
    },
  },
});

/** Enter commits what is typed: the field commits when it loses focus. */
function commitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") {
    event.currentTarget.blur();
  }
}

/** How many digits after the point a step needs: 0.01 needs two. */
function decimalsOf(step: number) {
  const text = String(step);
  const point = text.indexOf(".");
  return point < 0 ? 0 : text.length - point - 1;
}

/** Steppers whose steps mean more than minus and plus, such as a zoom's: their names, and glyphs in place of − and +. */
export interface ParameterFieldSteppers {
  decrement: string;
  icons?: { decrement: ReactNode; increment: ReactNode };
  increment: string;
}

export interface ParameterFieldProps {
  className?: string;
  /** The value it starts at, when it keeps its own value. @default min, or 0 */
  defaultValue?: number;
  disabled?: boolean;
  /** How the value is shown and read back, past `precision`: a sign, a percent, grouping (off by default). */
  format?: Intl.NumberFormatOptions;
  /**
   * Writes the value as text of its own, such as a position in bars.beats.16ths,
   * with `parseValue` to read typed text back: the field then keeps the
   * same look, keys and scrubbing, and `format`, `precision` and `steppers`
   * are left aside.
   */
  formatValue?: (value: number) => string;
  /** Keeps the label out of sight: it still names the field. @default false */
  hideLabel?: boolean;
  /** Names the field, shown at its start unless `hideLabel`: drag it to scrub. */
  label: string;
  /** The step of Shift, the Page keys, and a scrub with Shift held. @default step × 10 */
  largeStep?: number;
  max?: number;
  min?: number;
  /** Every change, as a scrub or a step goes; a typed value once it is committed. */
  onValueChange?: (value: number) => void;
  /** A gesture that changed the value ended: a scrub let go, a step, a typed value committed. */
  onValueCommitted?: (value: number) => void;
  /** Reads typed text back, with `formatValue`: `null` keeps the value as it was. */
  parseValue?: (text: string) => number | null;
  /** Digits after the point. @default as many as `step` has, or as `format` says when it is given */
  precision?: number;
  /**
   * Which way a drag on the label or the unit moves the value: sideways
   * (right is more) or up and down (up is more). `false` for no scrubbing.
   * @default "horizontal"
   */
  scrub?: "horizontal" | "vertical" | false;
  /** Pixels of drag per step when scrubbing. @default 4 */
  scrubSensitivity?: number;
  /** What the field shows at its start, when the label is longer than the room: "Start" for "Clip start". @default label */
  shortLabel?: string;
  /** "sm" for a dense panel. @default "default" */
  size?: "default" | "sm";
  /** The step of Alt, and of a scrub with Alt held. @default step ÷ 10 */
  smallStep?: number;
  /** @default 1 */
  step?: number;
  /** Adds a decrement and an increment button either side, named "Decrease" and "Increase" and the label, or as given. @default false */
  steppers?: boolean | ParameterFieldSteppers;
  /** The unit after the value, such as "dB", "Hz" or "BPM": drag it to scrub. */
  unit?: ReactNode;
  /** The value, when it is held outside. */
  value?: number;
}

const SCRUB_CURSOR = (
  <NumberField.ScrubAreaCursor className="drop-shadow-sm">
    <ArrowsHorizontalIcon className="size-5" />
  </NumberField.ScrubAreaCursor>
);

/**
 * A parameter's value as a field, the way a DAW shows one: type it and press
 * Enter, step it with the arrows (Shift for a large step, Alt for a small
 * one) and the Page keys, or drag its label or its unit to scrub it, one step
 * every few pixels, Shift and Alt held for coarse and fine. Typing is held in
 * the field until it is committed, so a half-typed number never reaches
 * `onValueChange`, and the wheel never changes it. Controlled with `value`,
 * or keeping its own from `defaultValue`.
 */
export function ParameterField(props: ParameterFieldProps) {
  return props.formatValue && props.parseValue ? (
    <TextParameterField
      {...props}
      formatValue={props.formatValue}
      parseValue={props.parseValue}
    />
  ) : (
    <NumberParameterField {...props} />
  );
}

/** The field of a number, through the number field underneath. */
function NumberParameterField({
  className,
  defaultValue,
  disabled = false,
  format,
  hideLabel = false,
  label,
  largeStep: largeStepProp,
  max,
  min,
  onValueChange,
  onValueCommitted,
  precision,
  scrub = "horizontal",
  scrubSensitivity = 4,
  shortLabel,
  size = "default",
  smallStep: smallStepProp,
  step = 1,
  steppers = false,
  unit,
  value: valueProp,
}: ParameterFieldProps) {
  const [own, setOwn] = useState(defaultValue ?? min ?? 0);
  const value = valueProp ?? own;
  const largeStep = largeStepProp ?? step * 10;
  const smallStep = smallStepProp ?? step / 10;
  const digits = precision ?? decimalsOf(step);
  // A format given says how many digits itself, unless a precision is asked for too.
  const shown = useMemo<Intl.NumberFormatOptions>(
    () => ({
      ...(format && precision === undefined
        ? {}
        : { maximumFractionDigits: digits, minimumFractionDigits: digits }),
      // 1200 Hz, as a DAW shows it, not 1,200.
      useGrouping: false,
      ...format,
    }),
    [digits, format, precision]
  );
  // The latest value, since a scrub sends several moves before the field re-renders.
  const latest = useRef(value);
  latest.current = value;
  // The part of a step the drag has moved but not yet completed.
  const remainder = useRef(0);

  const set = useCallback(
    (next: number) => {
      latest.current = next;
      if (valueProp === undefined) {
        setOwn(next);
      }
      onValueChange?.(next);
    },
    [onValueChange, valueProp]
  );

  const clamp = useCallback(
    (next: number) =>
      Math.min(
        max ?? Number.POSITIVE_INFINITY,
        Math.max(min ?? Number.NEGATIVE_INFINITY, next)
      ),
    [max, min]
  );

  const handleScrub = useCallback(
    (event: PointerEvent) => {
      // The field steps once per pixel moved, too fast to aim with: count the
      // pointer's own movement, one step per `scrubSensitivity` pixels.
      const moved = scrub === "vertical" ? -event.movementY : event.movementX;
      remainder.current += moved / scrubSensitivity;
      const whole = Math.trunc(remainder.current);
      if (whole === 0) {
        return;
      }
      remainder.current -= whole;
      let by = step;
      if (event.shiftKey) {
        by = largeStep;
      } else if (event.altKey) {
        by = smallStep;
      }
      const next = clamp(
        Number((latest.current + whole * by).toFixed(Math.max(digits, 6)))
      );
      if (next !== latest.current) {
        set(next);
      }
    },
    [clamp, digits, largeStep, scrub, scrubSensitivity, set, smallStep, step]
  );

  const handleValueChange = useCallback(
    (
      next: number | null,
      eventDetails: NumberField.Root.ChangeEventDetails
    ) => {
      // While it is being typed the field keeps its own text.
      if (
        next === null ||
        eventDetails.reason === "input-change" ||
        eventDetails.reason === "input-clear"
      ) {
        return;
      }
      if (eventDetails.reason === "scrub") {
        handleScrub(eventDetails.event as PointerEvent);
        return;
      }
      remainder.current = 0;
      if (next !== latest.current) {
        set(next);
      }
    },
    [handleScrub, set]
  );

  // The field's own value is not the scrubbed one: what is committed is the latest.
  const handleCommitted = useCallback(() => {
    remainder.current = 0;
    onValueCommitted?.(latest.current);
  }, [onValueCommitted]);

  const scrubbing = (content: ReactNode) =>
    scrub && !disabled ? (
      <NumberField.ScrubArea
        className={cn(
          "select-none",
          scrub === "vertical" ? "cursor-ns-resize" : "cursor-ew-resize"
        )}
        direction={scrub}
        pixelSensitivity={1}
      >
        {content}
        {SCRUB_CURSOR}
      </NumberField.ScrubArea>
    ) : (
      content
    );

  const small = size === "sm";
  const stepperNames =
    typeof steppers === "object"
      ? steppers
      : { decrement: `Decrease ${label}`, increment: `Increase ${label}` };
  const stepperIcons =
    typeof steppers === "object" ? steppers.icons : undefined;
  return (
    <NumberField.Root
      allowWheelScrub={false}
      data-size={size}
      data-slot="parameter-field"
      disabled={disabled}
      format={shown}
      largeStep={largeStep}
      max={max}
      min={min}
      onValueChange={handleValueChange}
      onValueCommitted={handleCommitted}
      render={
        <InputGroup
          className={cn(parameterFieldVariants({ size }), className)}
        />
      }
      smallStep={smallStep}
      step={step}
      value={value}
    >
      {hideLabel ? null : (
        <InputGroupAddon align="inline-start">
          {scrubbing(
            <InputGroupText
              className={cn(
                "text-muted-foreground text-xs uppercase tracking-wide",
                small && "text-[0.625rem]"
              )}
            >
              {shortLabel ?? label}
            </InputGroupText>
          )}
        </InputGroupAddon>
      )}
      {steppers ? (
        <InputGroupAddon align="inline-start">
          <NumberField.Decrement
            render={
              <InputGroupButton
                aria-label={stepperNames.decrement}
                size="icon-xs"
              />
            }
          >
            {stepperIcons?.decrement ?? <MinusIcon />}
          </NumberField.Decrement>
        </InputGroupAddon>
      ) : null}
      <NumberField.Input
        render={
          <InputGroupInput
            aria-label={label}
            className="min-w-0 text-end font-mono tabular-nums"
            onKeyDown={commitOnEnter}
          />
        }
      />
      {unit === undefined && !steppers ? null : (
        <InputGroupAddon align="inline-end">
          {unit === undefined
            ? null
            : scrubbing(
                <InputGroupText className="text-muted-foreground">
                  {unit}
                </InputGroupText>
              )}
          {steppers ? (
            <NumberField.Increment
              render={
                <InputGroupButton
                  aria-label={stepperNames.increment}
                  size="icon-xs"
                />
              }
            >
              {stepperIcons?.increment ?? <PlusIcon />}
            </NumberField.Increment>
          ) : null}
        </InputGroupAddon>
      )}
    </NumberField.Root>
  );
}

/**
 * The field of a value written as text of its own (`formatValue` and
 * `parseValue`): the same look, the same keys, and the label and the unit
 * scrubbed by a drag, through pointer capture.
 */
function TextParameterField({
  className,
  defaultValue,
  disabled = false,
  formatValue,
  hideLabel = false,
  label,
  largeStep: largeStepProp,
  max,
  min,
  onValueChange,
  onValueCommitted,
  parseValue,
  scrub = "horizontal",
  scrubSensitivity = 4,
  shortLabel,
  size = "default",
  smallStep: smallStepProp,
  step = 1,
  unit,
  value: valueProp,
}: ParameterFieldProps & {
  formatValue: (value: number) => string;
  parseValue: (text: string) => number | null;
}) {
  const [own, setOwn] = useState(defaultValue ?? min ?? 0);
  const value = valueProp ?? own;
  const largeStep = largeStepProp ?? step * 10;
  const smallStep = smallStepProp ?? step / 10;
  // What is typed, held until it is committed; null while the field shows the value.
  const [typed, setTyped] = useState<string | null>(null);
  const latest = useRef(value);
  latest.current = value;
  const remainder = useRef(0);

  const set = useCallback(
    (next: number) => {
      const clamped = Math.min(
        max ?? Number.POSITIVE_INFINITY,
        Math.max(min ?? Number.NEGATIVE_INFINITY, next)
      );
      if (clamped === latest.current) {
        return;
      }
      latest.current = clamped;
      if (valueProp === undefined) {
        setOwn(clamped);
      }
      onValueChange?.(clamped);
    },
    [max, min, onValueChange, valueProp]
  );
  const commit = useCallback(
    () => onValueCommitted?.(latest.current),
    [onValueCommitted]
  );
  const settle = useCallback(() => {
    if (typed !== null) {
      const next = parseValue(typed);
      if (next !== null && Number.isFinite(next)) {
        set(next);
        commit();
      }
      setTyped(null);
    }
  }, [commit, parseValue, set, typed]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setTyped(event.target.value),
    []
  );
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      const steps: Record<string, number> = {
        ArrowDown: -1,
        ArrowUp: 1,
        PageDown: -largeStep,
        PageUp: largeStep,
      };
      if (event.key in steps) {
        event.preventDefault();
        let by = step;
        if (event.shiftKey) {
          by = largeStep;
        } else if (event.altKey) {
          by = smallStep;
        }
        const move = steps[event.key] as number;
        set(latest.current + (Math.abs(move) === 1 ? move * by : move));
        commit();
        setTyped(null);
      } else if (event.key === "Enter") {
        event.preventDefault();
        settle();
      } else if (event.key === "Escape") {
        setTyped(null);
      }
    },
    [commit, largeStep, set, settle, smallStep, step]
  );

  // A drag on the label or the unit scrubs, one step every `scrubSensitivity` pixels.
  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!scrub || disabled || event.button !== 0) {
        return;
      }
      event.preventDefault();
      remainder.current = 0;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [disabled, scrub]
  );
  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        return;
      }
      const moved = scrub === "vertical" ? -event.movementY : event.movementX;
      remainder.current += moved / scrubSensitivity;
      const whole = Math.trunc(remainder.current);
      if (whole === 0) {
        return;
      }
      remainder.current -= whole;
      let by = step;
      if (event.shiftKey) {
        by = largeStep;
      } else if (event.altKey) {
        by = smallStep;
      }
      set(latest.current + whole * by);
    },
    [largeStep, scrub, scrubSensitivity, set, smallStep, step]
  );
  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
        commit();
      }
    },
    [commit]
  );
  const scrubProps =
    scrub && !disabled
      ? {
          className: cn(
            "touch-none select-none",
            scrub === "vertical" ? "cursor-ns-resize" : "cursor-ew-resize"
          ),
          onPointerCancel: handlePointerUp,
          onPointerDown: handlePointerDown,
          onPointerMove: handlePointerMove,
          onPointerUp: handlePointerUp,
        }
      : {};

  const small = size === "sm";
  return (
    <InputGroup
      className={cn(parameterFieldVariants({ size }), className)}
      data-disabled={disabled ? "" : undefined}
      data-size={size}
      data-slot="parameter-field"
    >
      {hideLabel ? null : (
        <InputGroupAddon align="inline-start">
          <InputGroupText
            {...scrubProps}
            className={cn(
              "text-muted-foreground text-xs uppercase tracking-wide",
              small && "text-[0.625rem]",
              scrubProps.className
            )}
          >
            {shortLabel ?? label}
          </InputGroupText>
        </InputGroupAddon>
      )}
      <InputGroupInput
        aria-label={label}
        className="min-w-0 text-end font-mono tabular-nums"
        disabled={disabled}
        onBlur={settle}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        value={typed ?? formatValue(value)}
      />
      {unit === undefined ? null : (
        <InputGroupAddon align="inline-end">
          <InputGroupText
            {...scrubProps}
            className={cn("text-muted-foreground", scrubProps.className)}
          >
            {unit}
          </InputGroupText>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
