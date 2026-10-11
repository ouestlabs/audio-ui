"use client";

import { NumberField } from "@base-ui/react/number-field";
import { useCallback, useId } from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
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

/** Whole beats per minute, whatever the field is typed or stepped to. */
const WHOLE: Intl.NumberFormatOptions = { maximumFractionDigits: 0 };

/** Enter commits what is typed: the field commits when it loses focus. */
function commitOnEnter(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") {
    event.currentTarget.blur();
  }
}

interface NumberStepperProps {
  className?: string;
  /** Names the step-down button. */
  decrementLabel: string;
  /** How the value is shown and parsed. */
  format?: Intl.NumberFormatOptions;
  /** Names the step-up button. */
  incrementLabel: string;
  /** The text the field is dragged by: drag it sideways to scrub the value. */
  label: string;
  /** Step of the Page keys and Shift + arrows. */
  largeStep?: number;
  max: number;
  min: number;
  onValueChange: (value: number) => void;
  step?: number;
  value: number;
}

/**
 * A labeled stepper: a number field between a decrement and an increment
 * button, controlled by `value`. Dragging the label scrubs the value. Typing
 * is held in the field until it is committed (Enter or leaving it), so a
 * half-typed number never reaches `onValueChange`; the buttons, the arrow keys
 * and the Page keys step it, and the wheel never does.
 */
export function NumberStepper({
  className,
  decrementLabel,
  format = WHOLE,
  incrementLabel,
  label,
  largeStep = 10,
  max,
  min,
  onValueChange,
  step = 1,
  value,
}: NumberStepperProps) {
  const labelId = useId();
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
      if (next !== value) {
        onValueChange(next);
      }
    },
    [onValueChange, value]
  );

  return (
    <NumberField.Root
      className={cn("flex items-center gap-4", className)}
      format={format}
      largeStep={largeStep}
      max={max}
      min={min}
      onValueChange={handleValueChange}
      step={step}
      value={value}
    >
      <NumberField.ScrubArea className="cursor-ew-resize select-none">
        <span className="text-muted-foreground text-xs" id={labelId}>
          {label}
        </span>
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
      <NumberField.Group render={<InputGroup className="w-32" />}>
        <InputGroupAddon align="inline-start">
          <NumberField.Decrement
            render={
              <InputGroupButton aria-label={decrementLabel} size="icon-xs" />
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
        <NumberField.Input
          render={
            <InputGroupInput
              aria-labelledby={labelId}
              className="text-center"
              onKeyDown={commitOnEnter}
            />
          }
        />
        <InputGroupAddon align="inline-end">
          <NumberField.Increment
            render={
              <InputGroupButton aria-label={incrementLabel} size="icon-xs" />
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
        </InputGroupAddon>
      </NumberField.Group>
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

/**
 * The tempo as a number field with its unit: whole beats per minute, from 20
 * to 200 unless told otherwise. Type it and press Enter, step it with the
 * arrow keys and the Page keys, or drag the `BPM` unit sideways to scrub it;
 * the wheel never changes it. It is one cell, so it joins a `ButtonGroup`.
 */
export function BpmControl({
  className,
  max = DEFAULT_MAX_BPM,
  min = DEFAULT_MIN_BPM,
  onValueChange,
  value,
}: BpmControlProps) {
  const handleValueChange = useCallback(
    (bpm: number | null, eventDetails: NumberField.Root.ChangeEventDetails) => {
      // While it is being typed the field keeps its own text.
      if (
        bpm === null ||
        eventDetails.reason === "input-change" ||
        eventDetails.reason === "input-clear"
      ) {
        return;
      }
      if (bpm !== value) {
        onValueChange(bpm);
      }
    },
    [onValueChange, value]
  );

  return (
    <NumberField.Root
      format={WHOLE}
      largeStep={10}
      max={max}
      min={min}
      onValueChange={handleValueChange}
      render={<InputGroup className={cn("w-24", className)} />}
      step={1}
      value={value}
    >
      <NumberField.Input
        render={
          <InputGroupInput
            aria-label={`Tempo in beats per minute, ${min} to ${max}`}
            className="tabular-nums"
            onKeyDown={commitOnEnter}
          />
        }
      />
      <InputGroupAddon align="inline-end">
        <NumberField.ScrubArea className="cursor-ew-resize select-none">
          <InputGroupText>BPM</InputGroupText>
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
      </InputGroupAddon>
    </NumberField.Root>
  );
}
