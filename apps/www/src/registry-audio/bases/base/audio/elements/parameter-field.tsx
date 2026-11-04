"use client";

import { NumberField } from "@base-ui/react/number-field";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/registry/bases/base/ui/input-group";

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

export interface ParameterFieldProps {
  className?: string;
  /** The value it starts at, when it keeps its own value. @default min, or 0 */
  defaultValue?: number;
  disabled?: boolean;
  /** How the value is shown and read back, past `precision`: a sign, a percent, grouping (off by default). */
  format?: Intl.NumberFormatOptions;
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
  /** Digits after the point. @default as many as `step` has */
  precision?: number;
  /**
   * Which way a drag on the label or the unit moves the value: sideways
   * (right is more) or up and down (up is more). `false` for no scrubbing.
   * @default "horizontal"
   */
  scrub?: "horizontal" | "vertical" | false;
  /** Pixels of drag per step when scrubbing. @default 4 */
  scrubSensitivity?: number;
  /** "sm" for a dense panel. @default "default" */
  size?: "default" | "sm";
  /** The step of Alt, and of a scrub with Alt held. @default step ÷ 10 */
  smallStep?: number;
  /** @default 1 */
  step?: number;
  /** Adds a decrement and an increment button either side. @default false */
  steppers?: boolean;
  /** The unit after the value, such as "dB", "Hz" or "BPM": drag it to scrub. */
  unit?: ReactNode;
  /** The value, when it is held outside. */
  value?: number;
}

const SCRUB_CURSOR = (
  <NumberField.ScrubAreaCursor className="drop-shadow-sm">
    <IconPlaceholder
      className="size-5"
      hugeicons="ArrowLeftRightIcon"
      lucide="MoveHorizontalIcon"
      phosphor="ArrowsHorizontalIcon"
      remixicon="RiArrowLeftRightLine"
      tabler="IconArrowsHorizontal"
    />
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
export function ParameterField({
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
  const shown = useMemo<Intl.NumberFormatOptions>(
    () => ({
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
      // 1200 Hz, as a DAW shows it, not 1,200.
      useGrouping: false,
      ...format,
    }),
    [digits, format]
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
          className={cn(
            "w-auto min-w-0",
            small && "h-7 text-xs [&_input]:text-xs",
            className
          )}
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
                "text-muted-foreground uppercase tracking-wide",
                small ? "text-[0.625rem]" : "text-xs"
              )}
            >
              {label}
            </InputGroupText>
          )}
        </InputGroupAddon>
      )}
      {steppers ? (
        <InputGroupAddon align="inline-start">
          <NumberField.Decrement
            render={
              <InputGroupButton
                aria-label={`Decrease ${label}`}
                size="icon-xs"
              />
            }
          >
            <IconPlaceholder
              hugeicons="MinusSignIcon"
              lucide="Minus"
              phosphor="MinusIcon"
              remixicon="RiSubtractLine"
              tabler="IconMinus"
            />
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
                  aria-label={`Increase ${label}`}
                  size="icon-xs"
                />
              }
            >
              <IconPlaceholder
                hugeicons="PlusSignIcon"
                lucide="Plus"
                phosphor="PlusIcon"
                remixicon="RiAddLine"
                tabler="IconPlus"
              />
            </NumberField.Increment>
          ) : null}
        </InputGroupAddon>
      )}
    </NumberField.Root>
  );
}
