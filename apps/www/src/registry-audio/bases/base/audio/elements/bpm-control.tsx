"use client";

import { NumberField } from "@base-ui/react/number-field";
import { type ReactNode, useCallback, useRef } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/registry/bases/base/ui/input-group";

const DEFAULT_MIN_BPM = 20;
const DEFAULT_MAX_BPM = 200;

/** Whole numbers, whatever the field is typed or stepped to. */
const WHOLE: Intl.NumberFormatOptions = { maximumFractionDigits: 0 };

/** Pixels of sideways drag per step when scrubbing: slow enough to land on a value, not to sweep past it. */
const SCRUB_PIXELS_PER_STEP = 8;

/** Enter commits what is typed: the field commits when it loses focus. */
function commitOnEnter(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") {
    event.currentTarget.blur();
  }
}

interface NumberControlProps {
  className?: string;
  /** How the value is shown and parsed. */
  format?: Intl.NumberFormatOptions;
  /** Names the field for assistive technology. */
  label: string;
  /** Step of the Page keys and Shift + arrows. */
  largeStep?: number;
  max: number;
  min: number;
  onValueChange: (value: number) => void;
  /** Pixels of drag per step when the unit is scrubbed. @default 10 */
  scrubSensitivity?: number;
  step?: number;
  /**
   * Adds a decrement and an increment button either side of the field, named
   * by these labels. `icons` replaces the minus and the plus, for a field
   * whose steps mean more than that, such as a zoom.
   */
  steppers?: {
    decrement: string;
    icons?: { decrement: ReactNode; increment: ReactNode };
    increment: string;
  };
  /** The unit: drag it sideways to scrub the value. It follows the value, or with `steppers` sits before the increment button. */
  unit: string;
  value: number;
}

/**
 * A number field with its unit, as one cell that joins a `ButtonGroup`: type
 * a value and press Enter, step it with the arrow keys and the Page keys,
 * drag the unit sideways to scrub it, and with `steppers` press the buttons
 * either side. Typing is held in the field until it is committed, so a
 * half-typed number never reaches `onValueChange`, and the wheel never
 * changes it.
 */
export function NumberControl({
  className,
  format = WHOLE,
  label,
  largeStep = 10,
  max,
  min,
  onValueChange,
  scrubSensitivity = SCRUB_PIXELS_PER_STEP,
  step = 1,
  steppers,
  unit,
  value,
}: NumberControlProps) {
  // The latest value, since a scrub sends several moves before the field re-renders.
  const latest = useRef(value);
  latest.current = value;
  // The part of a step the drag has moved but not yet completed.
  const remainder = useRef(0);

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
        // The field steps once per pixel moved, far too fast to aim with:
        // count the pointer's own movement instead, one step per
        // `scrubSensitivity` pixels.
        const moved = (eventDetails.event as PointerEvent).movementX;
        remainder.current += moved / scrubSensitivity;
        const whole = Math.trunc(remainder.current);
        if (whole === 0) {
          return;
        }
        remainder.current -= whole;
        const scrubbed = Math.min(
          max,
          Math.max(min, latest.current + whole * step)
        );
        if (scrubbed !== latest.current) {
          latest.current = scrubbed;
          onValueChange(scrubbed);
        }
        return;
      }
      remainder.current = 0;
      if (next !== value) {
        onValueChange(next);
      }
    },
    [max, min, onValueChange, scrubSensitivity, step, value]
  );

  // Dragging the unit scrubs the value.
  const unitScrub = (
    <NumberField.ScrubArea
      className="cursor-ew-resize select-none"
      pixelSensitivity={1}
    >
      <InputGroupText>{unit}</InputGroupText>
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
    </NumberField.ScrubArea>
  );

  return (
    <NumberField.Root
      format={format}
      largeStep={largeStep}
      max={max}
      min={min}
      onValueChange={handleValueChange}
      render={
        <InputGroup className={cn(steppers ? "w-44" : "w-24", className)} />
      }
      step={step}
      value={value}
    >
      {steppers ? (
        <InputGroupAddon align="inline-start">
          <NumberField.Decrement
            render={
              <InputGroupButton
                aria-label={steppers.decrement}
                size="icon-xs"
              />
            }
          >
            {steppers.icons?.decrement ?? (
              <IconPlaceholder
                hugeicons="MinusSignIcon"
                lucide="Minus"
                phosphor="MinusIcon"
                remixicon="RiSubtractLine"
                tabler="IconMinus"
              />
            )}
          </NumberField.Decrement>
        </InputGroupAddon>
      ) : null}
      <NumberField.Input
        render={
          <InputGroupInput
            aria-label={label}
            className={cn("tabular-nums", steppers && "text-center")}
            onKeyDown={commitOnEnter}
          />
        }
      />
      {steppers ? (
        <InputGroupAddon align="inline-end">
          {unitScrub}
          <NumberField.Increment
            render={
              <InputGroupButton
                aria-label={steppers.increment}
                size="icon-xs"
              />
            }
          >
            {steppers.icons?.increment ?? (
              <IconPlaceholder
                hugeicons="PlusSignIcon"
                lucide="Plus"
                phosphor="PlusIcon"
                remixicon="RiAddLine"
                tabler="IconPlus"
              />
            )}
          </NumberField.Increment>
        </InputGroupAddon>
      ) : (
        <InputGroupAddon align="inline-end">{unitScrub}</InputGroupAddon>
      )}
    </NumberField.Root>
  );
}

interface BpmControlProps {
  className?: string;
  max?: number;
  min?: number;
  onValueChange: (bpm: number) => void;
  value: number;
}

/** The tempo: whole beats per minute, from 20 to 200 unless told otherwise. */
export function BpmControl({
  max = DEFAULT_MAX_BPM,
  min = DEFAULT_MIN_BPM,
  ...props
}: BpmControlProps) {
  return (
    <NumberControl
      label={`Tempo in beats per minute, ${min} to ${max}`}
      max={max}
      min={min}
      unit="BPM"
      {...props}
    />
  );
}
