"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/registry/bases/base/ui/input-group";

const DEFAULT_MIN_BPM = 20;
const DEFAULT_MAX_BPM = 200;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface BpmControlProps {
  max?: number;
  min?: number;
  onValueChange: (bpm: number) => void;
  value: number;
}

/** A labeled BPM stepper, a decrement/increment `InputGroup` around a numeric field, synced to an external controlled `value`. Typed input is held in a local draft until blur/Enter so mid-typing states (an empty field, a partial number) never get clamped away on every keystroke. */
export function BpmControl({
  max = DEFAULT_MAX_BPM,
  min = DEFAULT_MIN_BPM,
  onValueChange,
  value,
}: BpmControlProps) {
  const inputId = useId();
  const labelId = useId();
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDraft(e.target.value);
    },
    []
  );

  const commitDraft = useCallback(() => {
    const parsed = Number(draft);
    // Leaving the field with what it already shows changes nothing.
    if (draft.trim() === "" || Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = clamp(parsed, min, max);
    if (next !== value) {
      onValueChange(next);
    }
    setDraft(String(next));
  }, [draft, max, min, onValueChange, value]);

  // The wheel over a focused number field would step it: a scroll must never change the tempo.
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur(),
    []
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      }
    },
    []
  );

  const handleDecrement = useCallback(() => {
    onValueChange(clamp(value - 1, min, max));
  }, [max, min, onValueChange, value]);

  const handleIncrement = useCallback(() => {
    onValueChange(clamp(value + 1, min, max));
  }, [max, min, onValueChange, value]);

  return (
    <div aria-label="BPM" className="flex items-center gap-4" role="group">
      <span className="text-muted-foreground text-xs" id={labelId}>
        BPM
      </span>
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <InputGroupButton
            aria-label="Decrease BPM"
            onClick={handleDecrement}
            size="icon-xs"
          >
            <IconPlaceholder
              hugeicons="MinusSignIcon"
              lucide="Minus"
              phosphor="MinusIcon"
              remixicon="RiSubtractLine"
              tabler="IconMinus"
            />
          </InputGroupButton>
        </InputGroupAddon>
        <InputGroupInput
          aria-labelledby={labelId}
          className="[appearance:textfield] text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          id={inputId}
          inputMode="numeric"
          max={max}
          min={min}
          onBlur={commitDraft}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onWheel={handleWheel}
          step={1}
          type="number"
          value={draft}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label="Increase BPM"
            onClick={handleIncrement}
            size="icon-xs"
          >
            <IconPlaceholder
              hugeicons="PlusSignIcon"
              lucide="Plus"
              phosphor="PlusIcon"
              remixicon="RiAddLine"
              tabler="IconPlus"
            />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
